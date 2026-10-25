import { describe, expect, test } from 'vitest';
import { formatClothingShortageTitle } from './clothingShortage';

describe('옷 부족 안내 제목', () => {
  test.each([
    [['top'] as const, '상의가 2개보다 적어 추천이 단조로울 수 있어요'],
    [['bottom'] as const, '하의가 2개보다 적어 추천이 단조로울 수 있어요'],
    [['shoes'] as const, '신발이 2개보다 적어 추천이 단조로울 수 있어요'],
    [
      ['top', 'bottom'] as const,
      '상의·하의가 각각 2개보다 적어 추천이 단조로울 수 있어요',
    ],
    [
      ['top', 'bottom', 'shoes'] as const,
      '상의·하의·신발이 각각 2개보다 적어 추천이 단조로울 수 있어요',
    ],
  ])('부족한 카테고리가 %j면 "%s"여야 한다.', (categories, title) => {
    expect(formatClothingShortageTitle(categories)).toBe(title);
  });

  test('부족한 카테고리를 받지 못하면 카테고리 없이 안내해야 한다.', () => {
    expect(formatClothingShortageTitle([])).toBe(
      '등록한 옷이 적어 추천이 단조로울 수 있어요',
    );
  });
});
