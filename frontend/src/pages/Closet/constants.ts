import type { ClothingCard } from '@/generated/models';

type ClothingCategory = NonNullable<ClothingCard['category_cd']>;

const CLOSET_PAGE_SIZE = 20;

export const CLOSET_LIST_PARAMS = { limit: CLOSET_PAGE_SIZE } as const;

export const CLOTHING_CATEGORY_LABEL: Record<ClothingCategory, string> = {
  outer: '아우터',
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  socks: '양말',
  accessories: '악세서리',
};
