import {
  isDefaultCorners,
  snapCorners,
  toPerspectiveParam,
} from '@/domains/clothingImageEdit/perspective';
import type { PerspectiveParamValue } from '@/domains/clothingImageEdit/perspective';
import { planSaveRequests } from '@/domains/clothingImageEdit/saveRequests';
import type { SaveRequest } from '@/domains/clothingImageEdit/saveRequests';
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
  isServerChanged: boolean;
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
  isServerChanged: false,
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

const planSaveJob = async (
  state: ImageEditorState,
  hasSavedMask: boolean,
  createFiles: SaveClothingImageEditParams['createFiles'],
): Promise<SaveJob | null> => {
  const requests = planSaveRequests({
    isDefaultTransform:
      getSaveAngle(state) === 0 && isDefaultCorners(state.corners),
    maskStatus: state.maskStatus,
    hasSavedMask,
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

  const job =
    resumableJob ??
    (await planSaveJob(state, session.hasSavedMask, createFiles));

  if (job === null) {
    return {
      outcome: { status: 'fileFailed' },
      session: { ...session, pendingJob: null },
    };
  }

  let { hasSavedMask, isServerChanged } = session;
  let lastResponse: ClothingDetail | null = null;

  for (let index = job.nextIndex; index < job.requests.length; index += 1) {
    try {
      lastResponse = await sendRequest(job.requests[index], job);
    } catch (error) {
      return {
        outcome: { status: 'requestFailed', error, lastResponse },
        session: {
          hasSavedMask,
          isServerChanged,
          pendingJob: { ...job, nextIndex: index },
        },
      };
    }

    hasSavedMask = hasBrushMask(lastResponse);
    isServerChanged = true;
  }

  return {
    outcome: { status: 'saved', response: lastResponse },
    session: createSaveSession(hasSavedMask),
  };
};
