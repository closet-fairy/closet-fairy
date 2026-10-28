import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { showToast } from '@/components/common/ToastProvider/ToastProvider.toast';
import { useRetryClothingClothingClothingIdRetryPost } from '@/generated/endpoints/clothing/clothing';
import {
  patchClothingProgress,
  refetchClothingList,
} from '@/pages/Closet/clothingListCache';

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;

interface UseRetryClothingParams {
  onRetried: (clothingId: number) => void;
}

const useRetryClothing = (params: UseRetryClothingParams) => {
  const { onRetried } = params;
  const queryClient = useQueryClient();
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const finishRetrying = (clothingId: number) => {
    setRetryingIds((ids) => {
      const nextIds = new Set(ids);
      nextIds.delete(clothingId);
      return nextIds;
    });
  };

  // 카드마다 따로 재시도할 수 있어서, 마지막 요청에만 도는 mutate 콜백 대신 훅 옵션에서 처리한다.
  const { mutate } = useRetryClothingClothingClothingIdRetryPost({
    mutation: {
      onMutate: ({ clothingId }) => {
        setRetryingIds((ids) => new Set(ids).add(clothingId));
      },
      onSuccess: (progress, { clothingId }) => {
        patchClothingProgress(queryClient, [progress]);
        onRetried(clothingId);
      },
      onError: (error, { clothingId }) => {
        /*
         * 409는 다른 탭이나 기기에서 먼저 재시도해 이미 실패 상태가 아닌 경우다.
         * 알리지 않고 목록을 다시 받아 실제 상태로 맞춘다. 그사이 지워진 옷(404)도 같다.
         */
        if (
          error.status === CONFLICT_STATUS ||
          error.status === NOT_FOUND_STATUS
        ) {
          void refetchClothingList(queryClient);
          onRetried(clothingId);
          return;
        }

        showToast({ tone: 'error', title: error.message });
      },
      onSettled: (_data, _error, { clothingId }) => {
        finishRetrying(clothingId);
      },
    },
  });

  const retry = (clothingId: number) => {
    if (!retryingIds.has(clothingId)) {
      mutate({ clothingId });
    }
  };

  return { retry, retryingIds };
};

export default useRetryClothing;
