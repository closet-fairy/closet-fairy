import { describe, expect, test } from 'vitest';
import type { OutfitItemResult } from '@/generated/models';
import { getOutfitThumbnails, limitOutfitThumbnails } from './outfitThumbnails';

const slot = (slot_cd: OutfitItemResult['slot_cd']) => ({
  slot_cd,
  accessory_type_cd: null,
});

const accessory = (
  accessory_type_cd: OutfitItemResult['accessory_type_cd'],
) => ({ slot_cd: 'accessories' as const, accessory_type_cd });

describe('채택 완료 썸네일 칸', () => {
  test('3개면 모두 보여 주고 남은 개수가 없어야 한다.', () => {
    const { visibleItems, hiddenCount } = getOutfitThumbnails([
      slot('top'),
      slot('bottom'),
      slot('shoes'),
    ]);

    expect(visibleItems).toHaveLength(3);
    expect(hiddenCount).toBe(0);
  });

  test('4개면 네 칸을 모두 아이템으로 채워야 한다.', () => {
    const { visibleItems, hiddenCount } = getOutfitThumbnails([
      slot('top'),
      slot('bottom'),
      slot('shoes'),
      slot('socks'),
    ]);

    expect(visibleItems).toHaveLength(4);
    expect(hiddenCount).toBe(0);
  });

  test('5개 이상이면 3개만 보여 주고 나머지 수를 알려야 한다.', () => {
    const { visibleItems, hiddenCount } = getOutfitThumbnails([
      slot('outer'),
      slot('top'),
      slot('bottom'),
      slot('shoes'),
      slot('socks'),
      accessory('hat'),
      accessory('bag'),
    ]);

    expect(visibleItems).toHaveLength(3);
    expect(hiddenCount).toBe(4);
  });
});

describe('채택 완료 썸네일 순서', () => {
  test('머리에서 발 순서로 정렬해야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      slot('socks'),
      slot('bottom'),
      slot('top'),
      accessory('hat'),
    ]);

    expect(visibleItems).toEqual([
      accessory('hat'),
      slot('top'),
      slot('bottom'),
      slot('socks'),
    ]);
  });

  test('아우터는 상의보다, 양말은 신발보다 앞에 와야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      slot('top'),
      slot('shoes'),
      slot('socks'),
      slot('outer'),
    ]);

    expect(visibleItems).toEqual([
      slot('outer'),
      slot('top'),
      slot('socks'),
      slot('shoes'),
    ]);
  });

  test('악세서리는 몸의 위치에 맞는 자리에 와야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      slot('bottom'),
      accessory('belt'),
      accessory('scarf'),
      accessory('eyewear'),
    ]);

    expect(visibleItems).toEqual([
      accessory('eyewear'),
      accessory('scarf'),
      accessory('belt'),
      slot('bottom'),
    ]);
  });

  test('5개 이상이면 머리 쪽 3개를 남겨야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      slot('top'),
      slot('bottom'),
      slot('shoes'),
      slot('socks'),
      accessory('hat'),
    ]);

    expect(visibleItems).toEqual([
      accessory('hat'),
      slot('top'),
      slot('bottom'),
    ]);
  });

  test('주얼리, 기타, 종류를 모르는 악세서리는 맨 뒤로 가야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      accessory('jewelry'),
      accessory(null),
      accessory('etc'),
      slot('shoes'),
    ]);

    expect(visibleItems[0]).toEqual(slot('shoes'));
    expect(visibleItems).toHaveLength(4);
  });
});

describe('응답 순서 썸네일 칸', () => {
  test('4개까지는 순서를 바꾸지 않고 모두 보여 줘야 한다.', () => {
    expect(limitOutfitThumbnails(['신발', '상의', '하의', '모자'])).toEqual({
      visibleItems: ['신발', '상의', '하의', '모자'],
      hiddenCount: 0,
    });
  });

  test('5개면 3칸과 남은 2개로 나눠야 한다.', () => {
    expect(limitOutfitThumbnails(['1', '2', '3', '4', '5'])).toEqual({
      visibleItems: ['1', '2', '3'],
      hiddenCount: 2,
    });
  });
});
