import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/apis/apiError';
import { subscribeSessionEnd } from '@/apis/authSession';
import {
  getListClothingClothingGetInfiniteQueryKey,
  uploadClothingClothingPost,
} from '@/generated/endpoints/clothing/clothing';

export interface ClothingUploadPhoto {
  file: File;
  previewUrl: string;
}

export interface ClothingUpload extends ClothingUploadPhoto {
  id: string;
  status: 'uploading' | 'failed';
  errorMessage: string | null;
}

export interface RejectedClothingPhoto {
  fileName: string;
  message: string;
}

interface ClothingUploadState {
  uploads: ClothingUpload[];
  rejectedPhotos: RejectedClothingPhoto[];
}

const UNKNOWN_FILE_NAME = '이름 없는 사진';

/*
 * 업로드는 옷장을 떠나도 이어지고, 실패한 사진은 장마다 다시 보내거나 치울 수 있어야 한다.
 * 그래서 화면이 아니라 모듈에 두고, 옷장에 돌아오면 남은 업로드를 그대로 다시 그린다.
 */
let state: ClothingUploadState = { uploads: [], rejectedPhotos: [] };

// 저장소를 비울 때마다 올린다. 그 전에 보낸 요청의 응답이 비운 뒤의 상태를 고치지 못하게 한다.
let generation = 0;

const listeners = new Set<() => void>();

// 보내는 중이거나 실패해 남은 사진이 있으면 앱을 닫기 전에 브라우저가 한 번 묻게 한다.
const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  // preventDefault만으로는 묻지 않는 예전 브라우저를 위해 함께 둔다.
  event.returnValue = '';
};

const setState = (nextState: ClothingUploadState) => {
  const hadUploads = state.uploads.length > 0;
  state = nextState;
  const hasUploads = state.uploads.length > 0;

  if (!hadUploads && hasUploads) {
    window.addEventListener('beforeunload', warnBeforeUnload);
  }

  if (hadUploads && !hasUploads) {
    window.removeEventListener('beforeunload', warnBeforeUnload);
  }

  listeners.forEach((listener) => listener());
};

const updateUploads = (
  ids: ReadonlySet<string>,
  update: (upload: ClothingUpload) => ClothingUpload | null,
) => {
  const uploads = state.uploads.flatMap((upload) => {
    if (!ids.has(upload.id)) {
      return [upload];
    }

    const nextUpload = update(upload);

    if (nextUpload === null) {
      URL.revokeObjectURL(upload.previewUrl);
      return [];
    }

    return [nextUpload];
  });

  setState({ ...state, uploads });
};

const sendUploads = async (
  queryClient: QueryClient,
  uploads: ClothingUpload[],
) => {
  const ids = new Set(uploads.map((upload) => upload.id));
  const sentGeneration = generation;
  /*
   * 받는 중이던 목록은 이 사진들이 빠진 응답이라 끊고 새로 받는다. 옷장을 떠나 있어도 미리 받아 둬야
   * 돌아왔을 때 임시 카드가 사라진 자리가 비어 보이지 않는다.
   */
  const refetchList = () =>
    queryClient.invalidateQueries({
      queryKey: getListClothingClothingGetInfiniteQueryKey(),
      refetchType: 'all',
    });

  try {
    const result = await uploadClothingClothingPost({
      files: uploads.map((upload) => upload.file),
    });

    await refetchList();

    if (sentGeneration !== generation) {
      return;
    }

    updateUploads(ids, () => null);

    if (result.rejected.length > 0) {
      setState({
        ...state,
        rejectedPhotos: [
          ...state.rejectedPhotos,
          ...result.rejected.map((photo) => ({
            fileName: photo.file_name ?? UNKNOWN_FILE_NAME,
            message: photo.message,
          })),
        ],
      });
    }
  } catch (error) {
    if (sentGeneration !== generation) {
      return;
    }

    const errorMessage =
      error instanceof ApiError ? error.message : '사진을 올리지 못했어요.';

    // 서버가 받은 뒤 응답만 끊겼을 수도 있어서, 실제로 등록됐는지 목록으로 확인할 수 있게 다시 받는다.
    void refetchList();
    updateUploads(ids, (upload) => ({
      ...upload,
      status: 'failed',
      errorMessage,
    }));
  }
};

export const startClothingUpload = (
  queryClient: QueryClient,
  photos: ClothingUploadPhoto[],
) => {
  const uploads = photos.map((photo): ClothingUpload => ({
    ...photo,
    id: crypto.randomUUID(),
    status: 'uploading',
    errorMessage: null,
  }));

  // 서버는 먼저 보낸 사진에 작은 id를 주고 목록은 id 내림차순이라, 임시 카드도 같은 순서로 맨 앞에 둔다.
  setState({
    ...state,
    uploads: [...[...uploads].reverse(), ...state.uploads],
  });

  return sendUploads(queryClient, uploads);
};

export const resendClothingUpload = (queryClient: QueryClient, id: string) => {
  const upload = state.uploads.find((item) => item.id === id);

  if (upload === undefined || upload.status !== 'failed') {
    return Promise.resolve();
  }

  const resending: ClothingUpload = {
    ...upload,
    status: 'uploading',
    errorMessage: null,
  };
  updateUploads(new Set([id]), () => resending);

  return sendUploads(queryClient, [resending]);
};

export const dismissClothingUpload = (id: string) => {
  updateUploads(new Set([id]), () => null);
};

export const clearRejectedClothingPhotos = () => {
  setState({ ...state, rejectedPhotos: [] });
};

export const getClothingUploadState = () => state;

export const subscribeClothingUploads = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const resetClothingUploads = () => {
  generation += 1;
  state.uploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl));
  setState({ uploads: [], rejectedPhotos: [] });
};

// 같은 탭에서 다른 계정으로 로그인해도 이전 계정의 사진이 남거나 그 계정으로 다시 보내지지 않게 한다.
subscribeSessionEnd(resetClothingUploads);
