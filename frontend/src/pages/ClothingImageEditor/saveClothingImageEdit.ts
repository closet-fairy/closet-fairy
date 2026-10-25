import {
  isDefaultCorners,
  snapCorners,
  toPerspectiveParam,
} from '@/domains/clothingImageEdit/perspective';
import type { PerspectiveParamValue } from '@/domains/clothingImageEdit/perspective';
import { planSaveRequests } from '@/domains/clothingImageEdit/saveRequests';
import type {
  MaskStatus,
  SaveRequest,
} from '@/domains/clothingImageEdit/saveRequests';
import type { ClothingDetail } from '@/generated/models';
import { getSaveAngle } from '@/pages/ClothingImageEditor/imageEditorState';
import type { ImageEditorState } from '@/pages/ClothingImageEditor/imageEditorState';

export interface SaveEditBody {
  rotation_angle: number;
  perspective_param: PerspectiveParamValue | null;
}

export interface SaveFiles {
  mask: File | null;
  display: File | null;
}

export interface SaveJob {
  state: ImageEditorState;
  requests: SaveRequest[];
  body: SaveEditBody;
  files: SaveFiles;
  nextIndex: number;
}

export interface SaveSession {
  hasSavedMask: boolean;
  // 편집기를 열 때 저장된 마스크가 있었는지다. 상태의 'initial'은 이 시점의 마스크를 뜻한다.
  initialHasSavedMask: boolean;
  isServerChanged: boolean;
  isServerMaskChanged: boolean;
  pendingJob: SaveJob | null;
}

export type SaveOutcome =
  | { status: 'saved'; response: ClothingDetail | null }
  | { status: 'fileFailed' }
  | {
      status: 'requestFailed';
      error: unknown;
      lastResponse: ClothingDetail | null;
    };

interface SaveClothingImageEditParams {
  session: SaveSession;
  state: ImageEditorState;
  isChanged: boolean;
  hasInvalidSavedEdit: boolean;
  createFiles: (requests: readonly SaveRequest[]) => Promise<SaveFiles>;
  sendRequest: (request: SaveRequest, job: SaveJob) => Promise<ClothingDetail>;
}

interface SaveClothingImageEditResult {
  outcome: SaveOutcome;
  session: SaveSession;
}

export const createSaveSession = (hasSavedMask: boolean): SaveSession => ({
  hasSavedMask,
  initialHasSavedMask: hasSavedMask,
  isServerChanged: false,
  isServerMaskChanged: false,
  pendingJob: null,
});

export const createSaveEditBody = (state: ImageEditorState): SaveEditBody => ({
  rotation_angle: getSaveAngle(state),
  perspective_param: toPerspectiveParam(snapCorners(state.corners)),
});

// 단계 이동처럼 저장 결과와 상관없는 변화는 같은 편집으로 본다.
const isSameSaveTarget = (a: ImageEditorState, b: ImageEditorState) =>
  a.quarterTurns === b.quarterTurns &&
  a.tilt === b.tilt &&
  a.corners === b.corners &&
  a.maskStatus === b.maskStatus &&
  a.maskVersion === b.maskVersion;

const hasBrushMask = (clothing: ClothingDetail) =>
  (clothing.edit?.brush_mask_url ?? null) !== null;

/*
 * 'initial'은 편집기를 열 때 불러온 마스크 그대로라는 뜻이다.
 * 앞선 저장이 중간에 실패해 서버의 마스크가 바뀌었으면 그 마스크와 더는 같지 않으므로,
 * 처음에 저장된 마스크가 없었으면 기본 마스크로, 있었으면 지금 마스크를 다시 올리는 것으로 본다.
 */
const getPlanMaskStatus = (
  state: ImageEditorState,
  session: SaveSession,
): MaskStatus => {
  if (state.maskStatus !== 'initial' || !session.isServerMaskChanged) {
    return state.maskStatus;
  }

  return session.initialHasSavedMask ? 'edited' : 'default';
};

const planSaveJob = async (
  state: ImageEditorState,
  session: SaveSession,
  createFiles: SaveClothingImageEditParams['createFiles'],
): Promise<SaveJob | null> => {
  const requests = planSaveRequests({
    isDefaultTransform:
      getSaveAngle(state) === 0 && isDefaultCorners(state.corners),
    maskStatus: getPlanMaskStatus(state, session),
    hasSavedMask: session.hasSavedMask,
  });

  try {
    const files = await createFiles(requests);

    return {
      state,
      requests,
      body: createSaveEditBody(state),
      files,
      nextIndex: 0,
    };
  } catch {
    return null;
  }
};

/*
 * 요청 세 번은 하나로 묶여 있지 않아, 중간에 실패하면 서버가 처음과 다른 상태로 남는다.
 * 편집 상태가 그대로면 실패한 요청부터 이어 보내고, 그사이 편집했으면 서버의 지금 상태를 기준으로 다시 계획한다.
 */
export const saveClothingImageEdit = async (
  params: SaveClothingImageEditParams,
): Promise<SaveClothingImageEditResult> => {
  const {
    session,
    state,
    isChanged,
    hasInvalidSavedEdit,
    createFiles,
    sendRequest,
  } = params;
  const { pendingJob } = session;
  const resumableJob =
    pendingJob !== null && isSameSaveTarget(pendingJob.state, state)
      ? pendingJob
      : null;

  if (
    resumableJob === null &&
    !isChanged &&
    !hasInvalidSavedEdit &&
    !session.isServerChanged
  ) {
    return {
      outcome: { status: 'saved', response: null },
      session: { ...session, pendingJob: null },
    };
  }

  const job = resumableJob ?? (await planSaveJob(state, session, createFiles));

  if (job === null) {
    return {
      outcome: { status: 'fileFailed' },
      session: { ...session, pendingJob: null },
    };
  }

  let { hasSavedMask, isServerChanged, isServerMaskChanged } = session;
  let lastResponse: ClothingDetail | null = null;

  for (let index = job.nextIndex; index < job.requests.length; index += 1) {
    try {
      lastResponse = await sendRequest(job.requests[index], job);
    } catch (error) {
      return {
        outcome: { status: 'requestFailed', error, lastResponse },
        session: {
          ...session,
          hasSavedMask,
          isServerChanged,
          isServerMaskChanged,
          pendingJob: { ...job, nextIndex: index },
        },
      };
    }

    const request = job.requests[index];
    hasSavedMask = hasBrushMask(lastResponse);
    isServerChanged = true;
    isServerMaskChanged ||= request === 'saveMask' || request === 'resetEdit';
  }

  return {
    outcome: { status: 'saved', response: lastResponse },
    session: createSaveSession(hasSavedMask),
  };
};
