import type { ClothingShortagePrecheckResponse } from '@/generated/models';

type ShortageCategory =
  ClothingShortagePrecheckResponse['shortage_categories'][number];

const SHORTAGE_CATEGORIES: Readonly<
  Record<ShortageCategory, { label: string; particle: string }>
> = {
  top: { label: '상의', particle: '가' },
  bottom: { label: '하의', particle: '가' },
  shoes: { label: '신발', particle: '이' },
};

const MIN_CLOTHING_COUNT = 2;

export const CLOTHING_SHORTAGE_DESCRIPTION =
  '모자란 옷은 기본 아이템으로 채워 추천합니다.';

export const formatClothingShortageTitle = (
  shortageCategories: readonly ShortageCategory[],
) => {
  const lastCategory = shortageCategories.at(-1);

  if (lastCategory === undefined) {
    return '등록한 옷이 적어 추천이 단조로울 수 있어요';
  }

  const labels = shortageCategories
    .map((category) => SHORTAGE_CATEGORIES[category].label)
    .join('·');
  const { particle } = SHORTAGE_CATEGORIES[lastCategory];
  const each = shortageCategories.length > 1 ? '각각 ' : '';

  return `${labels}${particle} ${each}${MIN_CLOTHING_COUNT}개보다 적어 추천이 단조로울 수 있어요`;
};
