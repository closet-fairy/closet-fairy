import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { getListClothingClothingGetInfiniteQueryKey } from '@/generated/endpoints/clothing/clothing';
import type { ClothingCard, ClothingPage } from '@/generated/models';

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
