import { describe, expect, test } from 'vitest';
import type { OutfitResult } from '@/generated/models';
import { getOutfitLayers, getRecommendationOrder } from './outfitLayers';

const createPreviousOutfit = (outfitId: number) => ({
  outfit_id: outfitId,
  outfit_seq: 1,
  outfit_type_cd: 'preferred' as const,
  reason: null,
  items: [],
});

describe('코디 겹 순서', () => {
  test('최신 코디부터 이전 코디 순으로 돌려줘야 한다.', () => {
    const outfit: OutfitResult = {
      ...createPreviousOutfit(3),
      previous_outfits: [createPreviousOutfit(2), createPreviousOutfit(1)],
    };

    expect(getOutfitLayers(outfit).map(({ outfit_id: id }) => id)).toEqual([
      3, 2, 1,
    ]);
  });
});

describe('추천 순번', () => {
  test.each([
    { depth: 0, order: 3 },
    { depth: 1, order: 2 },
    { depth: 2, order: 1 },
  ])('3장 중 깊이 $depth는 $order번째여야 한다.', ({ depth, order }) => {
    expect(getRecommendationOrder(3, depth)).toBe(order);
  });
});
