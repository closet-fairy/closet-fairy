import type { ClothingShortagePrecheckResponse } from '@/generated/models';

type ShortageCategory =
  ClothingShortagePrecheckResponse['shortage_categories'][number];

const SHORTAGE_CATEGORY_LABELS: Readonly<Record<ShortageCategory, string>> = {
  top: '상의',
  bottom: '하의',
  shoes: '신발',
};

const MIN_CLOTHING_COUNT = 2;

const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const HANGUL_FINAL_CONSONANT_COUNT = 28;

const hasFinalConsonant = (word: string) => {
  const code = word.codePointAt(word.length - 1) ?? 0;

  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) {
    return false;
  }

  return (code - HANGUL_SYLLABLE_START) % HANGUL_FINAL_CONSONANT_COUNT !== 0;
};

export const CLOTHING_SHORTAGE_DESCRIPTION =
  '모자란 옷은 기본 아이템으로 채워 추천합니다.';

export const formatClothingShortageTitle = (
  shortageCategories: readonly ShortageCategory[],
) => {
  if (shortageCategories.length === 0) {
    return '등록한 옷이 적어 추천이 단조로울 수 있어요';
  }

  const labels = shortageCategories
    .map((category) => SHORTAGE_CATEGORY_LABELS[category])
    .join('·');
  const particle = hasFinalConsonant(labels) ? '이' : '가';

  return `${labels}${particle} ${MIN_CLOTHING_COUNT}벌보다 적어 추천이 단조로울 수 있어요`;
};
