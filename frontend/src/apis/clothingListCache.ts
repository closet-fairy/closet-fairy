import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { getListClothingClothingGetInfiniteQueryKey } from '@/generated/endpoints/clothing/clothing';
import type {
  ClothingCard,
  ClothingPage,
  ClothingProgress,
} from '@/generated/models';

const isSameProgress = (card: ClothingCard, progress: ClothingProgress) =>
  card.processing_status_cd === progress.processing_status_cd &&
  card.is_queued === progress.is_queued &&
  card.image_url === progress.image_url &&
  card.failure_reason === progress.failure_reason;

// 상태 응답에는 처리 상태와 이미지만 있어서, 받아 둔 목록 카드의 그 부분만 고친다.
export const patchClothingProgress = (
  queryClient: QueryClient,
  progresses: ClothingProgress[],
) => {
  const progressById = new Map(
    progresses.map((progress) => [progress.clothing_id, progress]),
  );

  queryClient.setQueriesData<InfiniteData<ClothingPage>>(
    { queryKey: getListClothingClothingGetInfiniteQueryKey() },
    (data) => {
      if (data === undefined) {
        return data;
      }

      let isChanged = false;
      const pages = data.pages.map((page) => ({
        ...page,
        items: page.items.map((card) => {
          const progress = progressById.get(card.clothing_id);

          if (progress === undefined || isSameProgress(card, progress)) {
            return card;
          }

          isChanged = true;

          return {
            ...card,
            processing_status_cd: progress.processing_status_cd,
            is_queued: progress.is_queued,
            image_url: progress.image_url,
            failure_reason: progress.failure_reason,
          };
        }),
      }));

      // 1초마다 같은 상태가 와도 화면을 다시 그리지 않도록, 바뀐 카드가 없으면 원래 데이터를 돌려준다.
      return isChanged ? { ...data, pages } : data;
    },
  );
};

export const refetchClothingList = (queryClient: QueryClient) =>
  queryClient.invalidateQueries(
    { queryKey: getListClothingClothingGetInfiniteQueryKey() },
    // 이미 다시 받는 중이면 그 요청을 이어서 쓴다. 여러 곳에서 한꺼번에 불러도 재조회는 한 번만 나간다.
    { cancelRefetch: false },
  );

// 목록 전체를 다시 받지 않고, 받아 둔 목록에서 그 옷의 카드만 고친다.
export const patchClothingCard = (
  queryClient: QueryClient,
  clothingId: number,
  patch: Partial<ClothingCard>,
) => {
  queryClient.setQueriesData<InfiniteData<ClothingPage>>(
    { queryKey: getListClothingClothingGetInfiniteQueryKey() },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((card) =>
            card.clothing_id === clothingId ? { ...card, ...patch } : card,
          ),
        })),
      },
  );
};
