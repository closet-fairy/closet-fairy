import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import { snapCorners } from '@/domains/clothingImageEdit/perspective';
import type { SaveRequest } from '@/domains/clothingImageEdit/saveRequests';
import {
  getGetClothingClothingClothingIdGetQueryKey,
  getListClothingClothingGetInfiniteQueryKey,
  resetClothingEditClothingClothingIdEditDelete,
  saveClothingDisplayImageClothingClothingIdEditDisplayPut,
  saveClothingEditClothingClothingIdEditPut,
  saveClothingMaskClothingClothingIdEditMaskPut,
} from '@/generated/endpoints/clothing/clothing';
import type {
  ImageEditorSaveResult,
  ImageEditorSaveStatus,
} from '@/pages/ClothingImageEditor/components/ImageEditor/ImageEditor';
import { getSaveAngle } from '@/pages/ClothingImageEditor/imageEditorState';
import { renderToPngBlob } from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import type { EditorSources } from '@/pages/ClothingImageEditor/renderer/loadEditorSources';
import {
  createSaveSession,
  saveClothingImageEdit,
} from '@/pages/ClothingImageEditor/saveClothingImageEdit';
import type {
  SaveFiles,
  SaveJob,
  SaveSession,
} from '@/pages/ClothingImageEditor/saveClothingImageEdit';

interface SaveContext {
  sources: EditorSources;
  hasSavedMask: boolean;
  hasInvalidSavedEdit: boolean;
}

const FILE_ERROR_MESSAGE = '이미지를 만들지 못했어요.';
const SAVE_ERROR_MESSAGE = '이미지를 저장하지 못했어요.';

const NOT_FOUND_STATUS = 404;

const createPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });

const toPngFile = (blob: Blob | null, name: string) => {
  if (blob === null) {
    throw new Error(FILE_ERROR_MESSAGE);
  }

  return new File([blob], name, { type: 'image/png' });
};

const createSaveFiles = async (
  requests: readonly SaveRequest[],
  result: ImageEditorSaveResult,
  sources: EditorSources,
): Promise<SaveFiles> => {
  const { state, mask } = result;
  const maskFile = requests.includes('saveMask')
    ? toPngFile(await createPngBlob(mask), 'mask.png')
    : null;
  const displayFile = requests.includes('saveDisplay')
    ? toPngFile(
        await renderToPngBlob(sources.base, sources.size, mask, {
          corners: snapCorners(state.corners),
          angle: getSaveAngle(state),
        }),
        'display.png',
      )
    : null;

  return { mask: maskFile, display: displayFile };
};

const requireFile = (file: File | null) => {
  if (file === null) {
    throw new Error(FILE_ERROR_MESSAGE);
  }

  return file;
};

const sendSaveRequest = async (
  clothingId: number,
  request: SaveRequest,
  job: SaveJob,
) => {
  switch (request) {
    case 'resetEdit':
      return resetClothingEditClothingClothingIdEditDelete(clothingId);
    case 'saveEdit':
      return saveClothingEditClothingClothingIdEditPut(clothingId, job.body);
    case 'saveMask':
      return saveClothingMaskClothingClothingIdEditMaskPut(clothingId, {
        file: requireFile(job.files.mask),
      });
    case 'saveDisplay':
      return saveClothingDisplayImageClothingClothingIdEditDisplayPut(
        clothingId,
        { file: requireFile(job.files.display) },
      );
  }
};

const getSaveErrorMessage = (error: unknown) =>
  error instanceof ApiError && error.message !== ''
    ? error.message
    : SAVE_ERROR_MESSAGE;

const useSaveClothingImageEdit = (clothingId: number) => {
  const queryClient = useQueryClient();
  const detailQueryKey =
    getGetClothingClothingClothingIdGetQueryKey(clothingId);
  const sessionRef = useRef<SaveSession | null>(null);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [hasUnsavedServerChange, setHasUnsavedServerChange] = useState(false);

  const save = async (
    result: ImageEditorSaveResult,
    context: SaveContext,
  ): Promise<ImageEditorSaveStatus> => {
    const { sources, hasSavedMask, hasInvalidSavedEdit } = context;

    if (isSavingRef.current) {
      return 'failed';
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const { outcome, session } = await saveClothingImageEdit({
        session: sessionRef.current ?? createSaveSession(hasSavedMask),
        state: result.state,
        isChanged: result.isChanged,
        hasInvalidSavedEdit,
        createFiles: (requests) => createSaveFiles(requests, result, sources),
        sendRequest: (request, job) =>
          sendSaveRequest(clothingId, request, job),
      });
      sessionRef.current = session;
      setHasUnsavedServerChange(
        session.isServerChanged || session.pendingJob !== null,
      );

      const lastResponse =
        outcome.status === 'saved'
          ? outcome.response
          : outcome.status === 'requestFailed'
            ? outcome.lastResponse
            : null;

      if (lastResponse !== null) {
        queryClient.setQueryData(detailQueryKey, lastResponse);
        void queryClient.invalidateQueries({
          queryKey: getListClothingClothingGetInfiniteQueryKey(),
        });
      }

      switch (outcome.status) {
        case 'saved':
          setErrorMessage(null);
          return 'saved';
        case 'fileFailed':
          setErrorMessage(FILE_ERROR_MESSAGE);
          return 'failed';
        case 'requestFailed':
          if (
            outcome.error instanceof ApiError &&
            outcome.error.status === NOT_FOUND_STATUS
          ) {
            void queryClient.invalidateQueries({
              queryKey: getListClothingClothingGetInfiniteQueryKey(),
            });
            setErrorMessage(null);
            setIsNotFound(true);
          } else {
            // 응답을 받지 못한 요청이 서버에 반영됐을 수 있어, 다음에 열 때 상세를 새로 받는다.
            void queryClient.invalidateQueries({
              queryKey: detailQueryKey,
              refetchType: 'none',
            });
            setErrorMessage(
              isUnauthorizedError(outcome.error)
                ? null
                : getSaveErrorMessage(outcome.error),
            );
          }

          return 'failed';
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return { save, isSaving, errorMessage, isNotFound, hasUnsavedServerChange };
};

export default useSaveClothingImageEdit;
