import { useQueries } from '@tanstack/react-query';
import { isUnauthorizedError } from '@/apis/authSession';
import type { QueryFunctionContext } from '@tanstack/react-query';
import {
  getClothingStatusClothingStatusGet,
  getGetClothingStatusClothingStatusGetQueryKey,
} from '@/generated/endpoints/clothing/clothing';
import type { ClothingCard } from '@/generated/models';
import {
  patchClothingProgress,
  refetchClothingList,
} from '@/pages/Closet/clothingListCache';

const STATUS_POLL_INTERVAL_MS = 1000;

// 상태 조회 API가 한 번에 받는 옷 id 개수의 상한이다.
const STATUS_POLL_BATCH_SIZE = 50;

interface UseClothingStatusPollingParams {
  clothings: ClothingCard[];
  isEnabled: boolean;
}

const toBatches = (ids: number[]) =>
  Array.from(
    { length: Math.ceil(ids.length / STATUS_POLL_BATCH_SIZE) },
    (_, index) =>
      ids.slice(
        index * STATUS_POLL_BATCH_SIZE,
        (index + 1) * STATUS_POLL_BATCH_SIZE,
      ),
  );

/*
 * 불러온 카드 중 처리 중인 옷만 1초마다 상태를 묻는다. 상태 응답에는 이름·분류가 없으므로,
 * 처리가 끝난 옷이 생기면 목록을 다시 받아 그 카드를 채운다.
 */
const useClothingStatusPolling = (params: UseClothingStatusPollingParams) => {
  const { clothings, isEnabled } = params;
  const processingIds = clothings
    .filter((clothing) => clothing.processing_status_cd === 'processing')
    .map((clothing) => clothing.clothing_id);

  useQueries({
    queries: toBatches(processingIds).map((ids) => {
      const statusParams = { ids: ids.join(',') };

      return {
        queryKey: getGetClothingStatusClothingStatusGetQueryKey(statusParams),
        queryFn: async ({ client, signal }: QueryFunctionContext) => {
          const status = await getClothingStatusClothingStatusGet(
            statusParams,
            { signal },
          );
          const stillProcessing = status.items.filter(
            (item) => item.processing_status_cd === 'processing',
          );
          const stillProcessingIds = new Set(
            stillProcessing.map((item) => item.clothing_id),
          );

          patchClothingProgress(client, stillProcessing);

          // 응답에서 빠진 옷(그사이 지워진 옷)도 목록을 다시 받아야 카드가 사라진다.
          if (ids.some((id) => !stillProcessingIds.has(id))) {
            void refetchClothingList(client);
          }

          return status;
        },
        enabled: isEnabled,
        // 로그인이 만료되면 다시 로그인할 때까지 묻지 않는다.
        refetchInterval: (query: { state: { error: unknown } }) =>
          isUnauthorizedError(query.state.error)
            ? false
            : STATUS_POLL_INTERVAL_MS,
        gcTime: 0,
      };
    }),
  });
};

export default useClothingStatusPolling;
