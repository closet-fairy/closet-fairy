import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/apis/apiError';
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

const listeners = new Set<() => void>();

// 보내는 중이거나 실패해 남은 사진이 있으면 앱을 닫기 전에 브라우저가 한 번 묻게 한다.
const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault();
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

  try {
    const result = await uploadClothingClothingPost({
      files: uploads.map((upload) => upload.file),
    });

    // 받는 중이던 목록은 이 사진들이 빠진 응답이라, 끊고 새로 받은 뒤에 임시 카드를 치운다.
    await queryClient.invalidateQueries({
      queryKey: getListClothingClothingGetInfiniteQueryKey(),
    });
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
    const errorMessage =
      error instanceof ApiError ? error.message : '사진을 올리지 못했어요.';

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
  state.uploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl));
  setState({ uploads: [], rejectedPhotos: [] });
};
