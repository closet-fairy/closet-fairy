import { describe, expect, test } from 'vitest';
import {
  canUndoStroke,
  EMPTY_BRUSH_HISTORY,
  MAX_BRUSH_HISTORY,
  pushStroke,
  undoStroke,
} from '@/domains/clothingImageEdit/brushHistory';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import type { Quad } from '@/domains/clothingImageEdit/types';
import {
  createInitialEditorState,
  getEditState,
  getSaveAngle,
  hasChanges,
  imageEditorReducer,
} from './imageEditorState';
import type { ImageEditorAction, ImageEditorState } from './imageEditorState';

const SIZE = { width: 400, height: 600 };

const TILTED_CORNERS: Quad = [
  [0.1, 0.1],
  [0.9, 0.05],
  [0.95, 0.95],
  [0.05, 0.9],
];

const createState = (rotationAngle = 0, corners: Quad | null = null) =>
  createInitialEditorState({ rotationAngle, corners }, SIZE);

const reduce = (state: ImageEditorState, ...actions: ImageEditorAction[]) =>
  actions.reduce(imageEditorReducer, state);

const withStrokes = (count: number) => {
  let history = EMPTY_BRUSH_HISTORY;

  for (let index = 0; index < count; index += 1) {
    history = pushStroke(history, {
      mode: 'erase',
      radius: 4,
      points: [[index, index]],
    }).history;
  }

  return history;
};

describe('초기 상태 만들기', () => {
  test('저장된 각도를 방향과 기울기로 나누고 브러시 단계에서 시작해야 한다.', () => {
    const state = createState(84, TILTED_CORNERS);

    expect(state).toEqual({
      step: 'brush',
      quarterTurns: 1,
      tilt: -6,
      corners: TILTED_CORNERS,
      maskStatus: 'initial',
      maskVersion: 0,
    });
  });

  test('꼭짓점이 없으면 기본 꼭짓점으로 시작해야 한다.', () => {
    expect(createState(0, null).corners).toBe(DEFAULT_CORNERS);
  });

  test('저장된 꼭짓점이 꼬인 사각형이면 기본 꼭짓점으로 시작해야 한다.', () => {
    const twisted: Quad = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
    ];

    expect(createState(0, twisted).corners).toBe(DEFAULT_CORNERS);
  });

  test('저장된 꼭짓점이 0~1 범위를 벗어나면 기본 꼭짓점으로 시작해야 한다.', () => {
    const outside: Quad = [
      [-0.1, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];

    expect(createState(0, outside).corners).toBe(DEFAULT_CORNERS);
  });
});

describe('90° 회전', () => {
  test('시계 방향으로 네 번 돌리면 처음 방향으로 돌아와야 한다.', () => {
    const turn = { type: 'turnQuarter', direction: 1 } as const;
    const state = createState();

    expect(reduce(state, turn).quarterTurns).toBe(1);
    expect(reduce(state, turn, turn, turn).quarterTurns).toBe(3);
    expect(reduce(state, turn, turn, turn, turn).quarterTurns).toBe(0);
  });

  test('반시계 방향으로 돌리면 방향이 0에서 3으로 넘어가야 한다.', () => {
    const state = reduce(createState(), {
      type: 'turnQuarter',
      direction: -1,
    });

    expect(state.quarterTurns).toBe(3);
    expect(getSaveAngle(state)).toBe(-90);
  });

  test('90° 회전은 기울기를 바꾸지 않아야 한다.', () => {
    const state = reduce(
      createState(),
      { type: 'setTilt', tilt: 12 },
      { type: 'turnQuarter', direction: 1 },
    );

    expect(state.tilt).toBe(12);
    expect(getSaveAngle(state)).toBe(102);
  });
});

describe('기울기 설정', () => {
  test('범위 안의 기울기는 그대로 설정해야 한다.', () => {
    expect(reduce(createState(), { type: 'setTilt', tilt: -12 }).tilt).toBe(
      -12,
    );
  });

  test('범위를 넘는 기울기는 -45°~45°로 잘라야 한다.', () => {
    expect(reduce(createState(), { type: 'setTilt', tilt: 60 }).tilt).toBe(45);
    expect(reduce(createState(), { type: 'setTilt', tilt: -60 }).tilt).toBe(
      -45,
    );
  });

  test('기울기 45°에서도 방향은 그대로여야 한다.', () => {
    const state = reduce(createState(), { type: 'setTilt', tilt: 45 });

    expect(state.quarterTurns).toBe(0);
    expect(state.tilt).toBe(45);
  });
});

describe('전체 각도 설정', () => {
  test('전체 각도를 방향과 기울기로 나눠 설정해야 한다.', () => {
    const state = reduce(createState(), { type: 'setAngle', angle: 97 });

    expect(state.quarterTurns).toBe(1);
    expect(state.tilt).toBe(7);
  });

  test('범위를 넘는 각도는 같은 각도로 정규화해 설정해야 한다.', () => {
    const state = reduce(createState(), { type: 'setAngle', angle: 200 });

    expect(getSaveAngle(state)).toBe(-160);
  });

  test('지금과 같은 각도를 설정하면 방향과 기울기를 다시 나누지 않아야 한다.', () => {
    const state = reduce(createState(), { type: 'setTilt', tilt: 45 });

    expect(reduce(state, { type: 'setAngle', angle: 45 })).toBe(state);
  });

  test('지금 방향에서 기울기만으로 닿는 각도면 방향을 그대로 두어야 한다.', () => {
    const state = reduce(createState(), { type: 'setTilt', tilt: 30 });
    const next = reduce(state, { type: 'setAngle', angle: 45 });

    expect(next.quarterTurns).toBe(0);
    expect(next.tilt).toBe(45);
  });
});

describe('붓질 기록과 합친 편집 상태', () => {
  test('붓질하면 마스크 상태가 편집됨이 되고 비교용 번호가 올라가야 한다.', () => {
    const editState = getEditState(createState(), {
      history: withStrokes(1),
      revision: 1,
    });

    expect(editState.maskStatus).toBe('edited');
    expect(editState.maskVersion).toBe(1);
  });

  test('붓질을 모두 실행 취소하면 바뀐 게 없어야 한다.', () => {
    const initialState = createState();
    const { history } = undoStroke(withStrokes(1));
    const editState = getEditState(initialState, { history, revision: 2 });

    expect(editState.maskStatus).toBe('initial');
    expect(hasChanges(editState, initialState, { hasSavedMask: false })).toBe(
      false,
    );
  });

  test('원래대로 뒤에 붓질을 모두 취소하면 기본 마스크 상태로 돌아가야 한다.', () => {
    const state = reduce(createState(), { type: 'reset' });
    const editState = getEditState(state, {
      history: EMPTY_BRUSH_HISTORY,
      revision: 3,
    });

    expect(editState.maskStatus).toBe('default');
    expect(editState.maskVersion).toBe(4);
  });

  test('기록 한도를 넘겨 구워 넣은 획이 있으면 모두 취소해도 편집됨이어야 한다.', () => {
    let history = withStrokes(MAX_BRUSH_HISTORY + 1);

    while (canUndoStroke(history)) {
      history = undoStroke(history).history;
    }

    expect(
      getEditState(createState(), { history, revision: 1 }).maskStatus,
    ).toBe('edited');
  });
});

describe('원래대로', () => {
  test('방향, 기울기, 꼭짓점을 기본값으로 되돌리고 마스크를 기본 마스크로 바꿔야 한다.', () => {
    const state = reduce(
      createState(84, TILTED_CORNERS),
      { type: 'setStep', step: 'rotation' },
      { type: 'reset' },
    );

    expect(state).toEqual({
      step: 'rotation',
      quarterTurns: 0,
      tilt: 0,
      corners: DEFAULT_CORNERS,
      maskStatus: 'default',
      maskVersion: 1,
    });
  });
});

describe('바뀐 내용 확인', () => {
  const noSavedMask = { hasSavedMask: false };
  const savedMask = { hasSavedMask: true };

  test('불러온 그대로면 바뀐 게 없어야 한다.', () => {
    const initialState = createState(84, TILTED_CORNERS);
    const state = reduce(initialState, { type: 'setStep', step: 'rotation' });

    expect(hasChanges(state, initialState, noSavedMask)).toBe(false);
  });

  test('기울기를 바꾸면 바뀐 것이어야 한다.', () => {
    const initialState = createState();
    const state = reduce(initialState, { type: 'setTilt', tilt: 3 });

    expect(hasChanges(state, initialState, noSavedMask)).toBe(true);
  });

  test('방향과 기울기가 달라도 저장할 각도가 같으면 바뀐 게 없어야 한다.', () => {
    const initialState = createState(45);
    const state = reduce(
      initialState,
      { type: 'turnQuarter', direction: -1 },
      { type: 'setTilt', tilt: 45 },
    );

    expect(state.quarterTurns).not.toBe(initialState.quarterTurns);
    expect(hasChanges(state, initialState, noSavedMask)).toBe(false);
  });

  test('꼭짓점이 기본값으로 볼 만큼만 움직였으면 바뀐 게 없어야 한다.', () => {
    const initialState = createState();
    const state = reduce(initialState, {
      type: 'setCorners',
      corners: [
        [0.0005, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    });

    expect(hasChanges(state, initialState, noSavedMask)).toBe(false);
  });

  test('꼭짓점을 옮기면 바뀐 것이어야 한다.', () => {
    const initialState = createState();
    const state = reduce(initialState, {
      type: 'setCorners',
      corners: TILTED_CORNERS,
    });

    expect(hasChanges(state, initialState, noSavedMask)).toBe(true);
  });

  test('붓질하면 바뀐 것이어야 한다.', () => {
    const initialState = createState();
    const state = getEditState(initialState, {
      history: withStrokes(1),
      revision: 1,
    });

    expect(hasChanges(state, initialState, noSavedMask)).toBe(true);
  });

  test('저장된 마스크가 있을 때 원래대로를 누르면 바뀐 것이어야 한다.', () => {
    const initialState = createState();
    const state = reduce(initialState, { type: 'reset' });

    expect(hasChanges(state, initialState, savedMask)).toBe(true);
  });

  test('편집한 적 없는 옷에서 원래대로를 누르면 바뀐 게 없어야 한다.', () => {
    const initialState = createState();
    const state = reduce(
      initialState,
      { type: 'setTilt', tilt: 10 },
      { type: 'reset' },
    );

    expect(hasChanges(state, initialState, noSavedMask)).toBe(false);
  });
});
