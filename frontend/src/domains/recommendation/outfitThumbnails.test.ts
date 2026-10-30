import { describe, expect, test } from 'vitest';
import type { OutfitItemResult } from '@/generated/models';
import { getOutfitThumbnails } from './outfitThumbnails';

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
  test('큰 옷부터 작은 것 순서로 정렬해야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      accessory('watch'),
      accessory('hat'),
      slot('shoes'),
    ]);

    expect(visibleItems).toEqual([
      slot('shoes'),
      accessory('hat'),
      accessory('watch'),
    ]);
  });

  test('하의, 상의, 아우터가 잘리지 않고 앞에 와야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      accessory('hat'),
      slot('shoes'),
      slot('outer'),
      slot('top'),
      slot('bottom'),
    ]);

    expect(visibleItems).toEqual([slot('bottom'), slot('top'), slot('outer')]);
  });

  test('종류를 알 수 없는 악세서리는 맨 뒤로 가야 한다.', () => {
    const { visibleItems } = getOutfitThumbnails([
      accessory(null),
      accessory('belt'),
    ]);

    expect(visibleItems).toEqual([accessory('belt'), accessory(null)]);
  });
});
