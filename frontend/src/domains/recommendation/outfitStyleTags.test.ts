import { describe, expect, test } from 'vitest';
import type { OutfitItemResult } from '@/generated/models';
import { getOutfitStyleTags } from './outfitStyleTags';

const toItems = (...styleCds: OutfitItemResult['style_cds'][]) =>
  styleCds.map((style_cds) => ({ style_cds }));

describe('코디 단위 스타일 태그', () => {
  test('아이템 태그를 합쳐 많이 나온 순으로 2개를 골라야 한다.', () => {
    const items = toItems(
      ['minimal', 'casual'],
      ['casual', 'street'],
      ['street', 'casual'],
      ['minimal'],
      ['street'],
    );

    expect(getOutfitStyleTags(items)).toEqual(['casual', 'street']);
  });

  test('횟수가 같으면 먼저 나온 태그가 앞서야 한다.', () => {
    const items = toItems(['classic', 'minimal'], ['chic', 'casual']);

    expect(getOutfitStyleTags(items)).toEqual(['classic', 'minimal']);
  });

  test('태그가 하나뿐이면 하나만 돌려줘야 한다.', () => {
    expect(getOutfitStyleTags(toItems(['minimal'], []))).toEqual(['minimal']);
  });

  test('태그가 없으면 빈 배열을 돌려줘야 한다.', () => {
    expect(getOutfitStyleTags(toItems([], []))).toEqual([]);
  });
});
