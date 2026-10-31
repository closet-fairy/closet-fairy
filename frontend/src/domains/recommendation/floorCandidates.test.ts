import { describe, expect, test } from 'vitest';
import { getFloorCandidates, hasFloorCandidates } from './floorCandidates';

const createItem = (
  imageUrl: string | null,
  overrides: Partial<Parameters<typeof getFloorCandidates>[0][number]> = {},
) => ({
  slot_cd: 'top' as const,
  accessory_type_cd: null,
  item_name: '베이지 터틀넥',
  image_url: imageUrl,
  ...overrides,
});

describe('바닥에 놓을 옷 고르기', () => {
  test('사진이 있는 옷만 원래 순서 번호와 함께 골라야 한다.', () => {
    expect(
      getFloorCandidates([
        createItem(null),
        createItem('/top.webp', { item_name: '상의' }),
      ]),
    ).toEqual([{ id: '1', kind: 'top', name: '상의', imageUrl: '/top.webp' }]);
  });

  test('악세서리는 세부 종류를 쓰고, 세부 종류가 없으면 기타로 봐야 한다.', () => {
    const candidates = getFloorCandidates([
      createItem('/hat.webp', {
        slot_cd: 'accessories',
        accessory_type_cd: 'hat',
      }),
      createItem('/etc.webp', { slot_cd: 'accessories' }),
    ]);

    expect(candidates.map(({ kind }) => kind)).toEqual(['hat', 'etc']);
  });
});

describe('바닥에 놓을 옷이 있는지 판단', () => {
  test('사진이 있는 옷이 하나라도 있으면 있다고 봐야 한다.', () => {
    expect(hasFloorCandidates([createItem(null), createItem('/a.webp')])).toBe(
      true,
    );
  });

  test('사진이 있는 옷이 없으면 없다고 봐야 한다.', () => {
    expect(hasFloorCandidates([createItem(null)])).toBe(false);
    expect(hasFloorCandidates([])).toBe(false);
  });
});
