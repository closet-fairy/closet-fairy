import type { InfiniteData } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test } from 'vitest';
import { getListClothingClothingGetInfiniteQueryKey } from '@/generated/endpoints/clothing/clothing';
import type { ClothingCard, ClothingPage } from '@/generated/models';
import { removeClothingCard } from './clothingListCache';

const toCard = (clothingId: number): ClothingCard => ({
  clothing_id: clothingId,
  processing_status_cd: 'completed',
  is_queued: false,
  image_url: '/media/clothing/1/sample.webp',
  failure_reason: null,
  is_new: false,
  category_cd: 'top',
  item_name: `옷 ${clothingId}`,
  created_at: '2026-10-29T10:00:00+09:00',
});

const setUpCache = () => {
  const queryClient = new QueryClient();
  const queryKey = getListClothingClothingGetInfiniteQueryKey();
  const data: InfiniteData<ClothingPage> = {
    pages: [
      { items: [toCard(5), toCard(4)], next_cursor: 4, total_count: 3 },
      { items: [toCard(3)], next_cursor: null, total_count: 4 },
    ],
    pageParams: [null, 4],
  };
  queryClient.setQueryData(queryKey, data);

  const readTotalCounts = () =>
    queryClient
      .getQueryData<InfiniteData<ClothingPage>>(queryKey)
      ?.pages.map((page) => page.total_count);

  return { queryClient, readTotalCounts };
};

describe('removeClothingCard', () => {
  test('카드를 뺀 경우 받아 둔 모든 페이지의 총 개수를 1 줄여야 한다.', () => {
    const { queryClient, readTotalCounts } = setUpCache();

    removeClothingCard(queryClient, 4);

    expect(readTotalCounts()).toEqual([2, 3]);
  });

  test('이미 빠진 카드로 다시 불려도 총 개수를 두 번 줄이지 않아야 한다.', () => {
    const { queryClient, readTotalCounts } = setUpCache();

    removeClothingCard(queryClient, 4);
    removeClothingCard(queryClient, 4);

    expect(readTotalCounts()).toEqual([2, 3]);
  });

  test('받아 둔 목록에 없는 카드는 총 개수를 건드리지 않아야 한다.', () => {
    const { queryClient, readTotalCounts } = setUpCache();

    removeClothingCard(queryClient, 99);

    expect(readTotalCounts()).toEqual([3, 4]);
  });
});
