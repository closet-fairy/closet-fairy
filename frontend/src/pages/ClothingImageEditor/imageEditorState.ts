import {
  combineAngle,
  normalizeAngle,
  normalizeQuarterTurns,
  splitAngle,
  TILT_LIMIT,
} from '@/domains/clothingImageEdit/angle';
import {
  DEFAULT_CORNERS,
  isDefaultCorners,
  isValidQuad,
  snapCorners,
} from '@/domains/clothingImageEdit/perspective';
import { getBrushMaskStatus } from '@/domains/clothingImageEdit/brushHistory';
import type { BrushHistory } from '@/domains/clothingImageEdit/brushHistory';
import { isDefaultMask } from '@/domains/clothingImageEdit/saveRequests';
import type { MaskStatus } from '@/domains/clothingImageEdit/saveRequests';
import type { Quad, Size } from '@/domains/clothingImageEdit/types';

export type EditorStep = 'brush' | 'perspective' | 'rotation';

export interface ImageEditorState {
  step: EditorStep;
  quarterTurns: number;
  tilt: number;
  corners: Quad;
  maskStatus: MaskStatus;
  maskVersion: number;
}

export interface InitialEdit {
  rotationAngle: number;
  corners: Quad | null;
}

export type ImageEditorAction =
  | { type: 'setStep'; step: EditorStep }
  | { type: 'turnQuarter'; direction: 1 | -1 }
  | { type: 'setTilt'; tilt: number }
  | { type: 'setAngle'; angle: number }
  | { type: 'setCorners'; corners: Quad }
  | { type: 'reset' };

export const createInitialEditorState = (
  initialEdit: InitialEdit,
  size: Size,
): ImageEditorState => {
  const { rotationAngle, corners } = initialEdit;
  const { quarterTurns, tilt } = splitAngle(rotationAngle);

  return {
    step: 'brush',
    quarterTurns,
    tilt,
    // 잘못 저장된 꼭짓점으로는 그릴 수 없으므로 기본값으로 시작한다.
    corners:
      corners !== null && isValidQuad(corners, size)
        ? corners
        : DEFAULT_CORNERS,
    maskStatus: 'initial',
    maskVersion: 0,
  };
};

const clampTilt = (tilt: number) => {
  if (!Number.isFinite(tilt)) {
    return 0;
  }

  const clamped = Math.min(Math.max(tilt, -TILT_LIMIT), TILT_LIMIT);

  return clamped === 0 ? 0 : clamped;
};

export const getSaveAngle = (state: ImageEditorState) =>
  combineAngle(state.quarterTurns, state.tilt);

export const imageEditorReducer = (
  state: ImageEditorState,
  action: ImageEditorAction,
): ImageEditorState => {
  switch (action.type) {
    case 'setStep':
      return { ...state, step: action.step };
    case 'turnQuarter':
      return {
        ...state,
        quarterTurns: normalizeQuarterTurns(
          state.quarterTurns + action.direction,
        ),
      };
    case 'setTilt':
      return { ...state, tilt: clampTilt(action.tilt) };
    case 'setAngle': {
      /*
       * 각도를 새로 나누면 45°가 방향 90°와 기울기 -45°가 되어 슬라이더가 반대쪽 끝으로 튄다.
       * 지금 방향에서 기울기만으로 닿는 각도면 방향을 그대로 둔다.
       */
      const tilt = normalizeAngle(
        normalizeAngle(action.angle) - state.quarterTurns * 90,
      );

      if (Math.abs(tilt) <= TILT_LIMIT) {
        return tilt === state.tilt ? state : { ...state, tilt };
      }

      return { ...state, ...splitAngle(action.angle) };
    }
    case 'setCorners':
      return { ...state, corners: action.corners };
    case 'reset':
      return {
        ...state,
        quarterTurns: 0,
        tilt: 0,
        corners: DEFAULT_CORNERS,
        maskStatus: 'default',
        maskVersion: state.maskVersion + 1,
      };
  }
};

interface BrushEdit {
  history: BrushHistory;
  // 붓질 기록이 바뀔 때마다 오르는 번호다.
  revision: number;
}

/*
 * 리듀서는 기준 마스크가 불러온 것인지 기본인지만 든다. 붓질 기록과 합쳐야 실제 마스크 상태가 된다.
 * 붓질은 GPU에 바뀐 영역만 올리므로 리듀서의 maskVersion을 올리지 않고, 저장 비교용 번호에만 더한다.
 */
export const getEditState = (
  state: ImageEditorState,
  brush: BrushEdit,
): ImageEditorState => ({
  ...state,
  maskStatus: getBrushMaskStatus(
    brush.history,
    state.maskStatus === 'default' ? 'default' : 'initial',
  ),
  maskVersion: state.maskVersion + brush.revision,
});

const isSameQuad = (a: Quad, b: Quad) =>
  a.every(
    (point, index) => point[0] === b[index][0] && point[1] === b[index][1],
  );

interface MaskContext {
  hasSavedMask: boolean;
}

/*
 * 저장된 마스크가 없으면 처음 마스크가 곧 기본 마스크라, [원래대로]로 기본 마스크가 되어도 바뀐 것이 아니다.
 * 방향과 기울기는 따로 보지 않고 저장할 각도로 비교한다. 방향 0°·기울기 45°와 방향 90°·기울기 -45°는 같은 결과다.
 */
export const hasChanges = (
  state: ImageEditorState,
  initialState: ImageEditorState,
  context: MaskContext,
) => {
  const { hasSavedMask } = context;
  const isMaskChanged =
    state.maskStatus !== initialState.maskStatus &&
    isDefaultMask(state.maskStatus, hasSavedMask) !==
      isDefaultMask(initialState.maskStatus, hasSavedMask);

  return (
    getSaveAngle(state) !== getSaveAngle(initialState) ||
    !isSameQuad(
      snapCorners(state.corners),
      snapCorners(initialState.corners),
    ) ||
    state.maskStatus === 'edited' ||
    isMaskChanged
  );
};

export const isAllDefault = (state: ImageEditorState, context: MaskContext) => {
  const { hasSavedMask } = context;

  return (
    getSaveAngle(state) === 0 &&
    isDefaultCorners(state.corners) &&
    isDefaultMask(state.maskStatus, hasSavedMask)
  );
};
