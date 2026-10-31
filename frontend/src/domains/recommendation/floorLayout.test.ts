import { describe, expect, test } from 'vitest';
import { getFloorItemKind, layoutFloor } from './floorLayout';
import type { FloorItem, FloorPlacement } from './floorLayout';
import { FLOOR_CARD } from './floorLayout.constants';
import type { FloorItemKind } from './floorLayout.constants';

const SEED = { order: 1, id: 4101 };
const FLOOR_BOTTOM = FLOOR_CARD.height - FLOOR_CARD.reservedBottom;
const ROTATION_INSET = 4;

const createItems = (kinds: readonly FloorItemKind[], ratio = 0.8) =>
  kinds.map((kind, index): FloorItem => ({ id: `${index}`, kind, ratio }));

const FULL_OUTFIT = createItems([
  'hat',
  'eyewear',
  'outer',
  'top',
  'bag',
  'bottom',
  'socks',
  'shoes',
]);

const MIXED_OUTFITS = [
  createItems(['top', 'bottom', 'shoes']),
  createItems(['outer', 'top', 'bottom', 'shoes']),
  createItems(['hat', 'outer', 'top', 'bottom', 'socks', 'shoes']),
  FULL_OUTFIT,
  FULL_OUTFIT.map((item, index) => ({
    ...item,
    ratio: index % 2 === 0 ? 1.6 : 0.5,
  })),
];

const GOLDEN_THREE = [
  { id: 'bottom', x: 38, y: 121.7, width: 151, height: 335.7, rotation: 4.6 },
  { id: 'top', x: 199, y: 54.7, width: 149, height: 165.6, rotation: -5.2 },
  { id: 'shoes', x: 199, y: 230.2, width: 134.7, height: 89.8, rotation: -2.6 },
];

const GOLDEN_SIX = [
  { id: 'top', x: 14, y: 104.3, width: 175, height: 194.4, rotation: -4.5 },
  {
    id: 'jewelry',
    x: 122.1,
    y: 308.7,
    width: 66.9,
    height: 66.9,
    rotation: 5.9,
  },
  { id: 'etc', x: 115.7, y: 385.6, width: 73.3, height: 61.1, rotation: -4.2 },
  { id: 'scarf', x: 199, y: 65.3, width: 79.2, height: 56.6, rotation: 5.6 },
  { id: 'belt', x: 199, y: 131.8, width: 115.9, height: 38.6, rotation: 5.4 },
  { id: 'watch', x: 199, y: 180.5, width: 59.9, height: 74.8, rotation: -4.4 },
];

const GOLDEN_EIGHT = [
  { id: 'hat', x: 173, y: 14, width: 70, height: 53.8, rotation: 3.6 },
  { id: 'eyewear', x: 253, y: 21.1, width: 95, height: 39.6, rotation: -4.2 },
  { id: 'top', x: 173, y: 77.8, width: 175, height: 194.4, rotation: -5.9 },
  { id: 'bag', x: 173, y: 282.3, width: 113.1, height: 102.8, rotation: -4 },
  { id: 'socks', x: 296.1, y: 296.6, width: 51.9, height: 74.1, rotation: 3.1 },
  { id: 'shoes', x: 173, y: 395.1, width: 139.1, height: 87, rotation: -4.2 },
  { id: 'outer', x: 14, y: 35, width: 149, height: 186.3, rotation: 6 },
  { id: 'bottom', x: 51, y: 231.3, width: 112, height: 266.7, rotation: 5.8 },
];

const SEEDS = [1, 2, 3, 4].map((order) => ({ order, id: 4100 + order }));

const getCorners = ({ x, y, width, height, rotation }: FloorPlacement) => {
  const radian = (rotation * Math.PI) / 180;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([signX, signY]) => {
    const offsetX = (signX * width) / 2;
    const offsetY = (signY * height) / 2;

    return {
      x: centerX + offsetX * Math.cos(radian) - offsetY * Math.sin(radian),
      y: centerY + offsetX * Math.sin(radian) + offsetY * Math.cos(radian),
    };
  });
};

const eachLayout = () =>
  MIXED_OUTFITS.flatMap((items) =>
    SEEDS.map((seed) => layoutFloor(items, seed)),
  );

const roundPlacement = (placement: FloorPlacement) => ({
  id: placement.id,
  x: Math.round(placement.x * 10) / 10,
  y: Math.round(placement.y * 10) / 10,
  width: Math.round(placement.width * 10) / 10,
  height: Math.round(placement.height * 10) / 10,
  rotation: Math.round(placement.rotation * 10) / 10,
});

describe('고정된 배치', () => {
  test('같은 코디는 언제나 같은 좌표가 나와야 한다.', () => {
    expect(layoutFloor(FULL_OUTFIT, SEED)).toEqual(
      layoutFloor(FULL_OUTFIT, SEED),
    );
  });

  test('코디 번호가 다르면 다른 배치가 나올 수 있어야 한다.', () => {
    const layouts = [4101, 4102, 4103, 4104].map((id) =>
      JSON.stringify(layoutFloor(FULL_OUTFIT, { order: 1, id }).placements),
    );

    expect(new Set(layouts).size).toBeGreaterThan(1);
  });

  test('코디 순서의 짝홀이 같으면 같은 배치가 나와야 한다.', () => {
    expect(layoutFloor(FULL_OUTFIT, { order: 1, id: 4101 })).toEqual(
      layoutFloor(FULL_OUTFIT, { order: 3, id: 4101 }),
    );
  });

  test('코디 순서가 홀수면 넓은 열을 왼쪽에, 짝수면 오른쪽에 둬야 한다.', () => {
    const items = createItems(['top', 'bottom', 'shoes']);
    const isLargestOnLeft = (order: number) => {
      const { placements } = layoutFloor(items, { order, id: 4101 });
      const largest = placements.reduce((best, placement) =>
        placement.width * placement.height > best.width * best.height
          ? placement
          : best,
      );

      return largest.x + largest.width / 2 < FLOOR_CARD.width / 2;
    };

    expect(isLargestOnLeft(1)).toBe(true);
    expect(isLargestOnLeft(2)).toBe(false);
  });
});

describe('8개 초과', () => {
  test('8개까지만 놓고 나머지 수를 알려야 한다.', () => {
    const items = createItems([
      ...FULL_OUTFIT.map(({ kind }) => kind),
      'belt',
      'jewelry',
      'etc',
    ]);
    const { placements, overflowCount } = layoutFloor(items, SEED);

    expect(placements).toHaveLength(8);
    expect(overflowCount).toBe(3);
  });

  test('우선순위가 낮은 옷부터 바닥에서 빠져야 한다.', () => {
    const items = createItems([
      'jewelry',
      'scarf',
      'socks',
      'bag',
      'hat',
      'outer',
      'top',
      'bottom',
      'shoes',
    ]);
    const { placements } = layoutFloor(items, SEED);

    expect(placements.map(({ id }) => id)).not.toContain('0');
  });

  test('가방은 모자보다 먼저 바닥에서 빠져야 한다.', () => {
    const items = createItems(['bag', 'hat', ...Array<'top'>(7).fill('top')]);
    const { placements, overflowCount } = layoutFloor(items, SEED);

    expect(overflowCount).toBe(1);
    expect(placements.map(({ id }) => id)).not.toContain('0');
  });

  test('같은 우선순위라면 뒤에 있는 옷부터 빠져야 한다.', () => {
    const items = createItems([
      'top',
      'top',
      'top',
      'top',
      'top',
      'top',
      'top',
      'top',
      'top',
    ]);
    const { placements } = layoutFloor(items, SEED);

    expect(placements.map(({ id }) => id)).not.toContain('8');
  });

  test('8개 이하면 넘치는 옷이 없어야 한다.', () => {
    expect(layoutFloor(FULL_OUTFIT, SEED).overflowCount).toBe(0);
  });
});

describe('칸 배치', () => {
  test('회전 전의 칸은 서로 겹치지 않아야 한다.', () => {
    eachLayout().forEach(({ placements }) => {
      placements.forEach((left, leftIndex) => {
        placements.slice(leftIndex + 1).forEach((right) => {
          const isApart =
            left.x + left.width <= right.x + 0.001 ||
            right.x + right.width <= left.x + 0.001 ||
            left.y + left.height <= right.y + 0.001 ||
            right.y + right.height <= left.y + 0.001;

          expect(isApart).toBe(true);
        });
      });
    });
  });

  test('칸은 옷 비율과 같아야 한다.', () => {
    const items = createItems(['top', 'bottom', 'shoes'], 1.25);

    layoutFloor(items, SEED).placements.forEach(({ width, height }) => {
      expect(width / height).toBeCloseTo(1.25);
    });
  });

  test('큰 옷은 등급 상한을 넘게 커지지 않아야 한다.', () => {
    const items = createItems(['top', 'bottom'], 0.4);

    layoutFloor(items, SEED).placements.forEach(({ width, height }) => {
      expect(width * height).toBeLessThanOrEqual(30000 * 1.3 ** 2 + 0.001);
    });
  });

  test('옷이 적으면 목표를 키우되 네 배까지만 키워야 한다.', () => {
    const [{ width, height }] = layoutFloor(
      createItems(['hat'], 1),
      SEED,
    ).placements;

    expect(width * height).toBeCloseTo(16000);
  });

  test('옷이 하나면 카드 가로 가운데에 놓아야 한다.', () => {
    const { placements } = layoutFloor(createItems(['top']), SEED);

    expect(placements).toHaveLength(1);
    expect(placements[0].x + placements[0].width / 2).toBeCloseTo(
      FLOOR_CARD.width / 2,
    );
  });

  test('옷이 하나면 납작해도 쓸 수 있는 높이의 가운데에 놓아야 한다.', () => {
    const [{ y, height }] = layoutFloor(
      createItems(['belt'], 10),
      SEED,
    ).placements;

    expect(y + height / 2).toBeCloseTo((FLOOR_CARD.edge + 498) / 2);
  });

  test('옷이 하나면 가운데에 놓은 자리를 기준으로 회전각을 정해야 한다.', () => {
    const [{ rotation }] = layoutFloor(
      createItems(['top'], 0.4),
      SEED,
    ).placements;

    expect(Math.abs(rotation)).toBeGreaterThanOrEqual(2.4);
  });

  test('놓을 옷이 없으면 빈 배치를 돌려줘야 한다.', () => {
    expect(layoutFloor([], SEED)).toEqual({ placements: [], overflowCount: 0 });
  });
});

describe('회전', () => {
  test('옷은 6도 안에서 돌아가야 한다.', () => {
    const rotations = eachLayout().flatMap(({ placements }) =>
      placements.map(({ rotation }) => rotation),
    );

    expect(Math.max(...rotations.map(Math.abs))).toBeLessThanOrEqual(6);
    expect(Math.max(...rotations.map(Math.abs))).toBeGreaterThan(4);
    expect(rotations.some((rotation) => rotation > 0)).toBe(true);
    expect(rotations.some((rotation) => rotation < 0)).toBe(true);
  });

  test('돌린 뒤에도 카드 밖이나 태그 띠로 넘어가지 않아야 한다.', () => {
    const tightOutfit = createItems(['top', 'bottom'], 0.61);

    [...eachLayout(), layoutFloor(tightOutfit, SEED)].forEach(
      ({ placements }) => {
        placements.flatMap(getCorners).forEach(({ x, y }) => {
          expect(x).toBeGreaterThanOrEqual(ROTATION_INSET - 0.001);
          expect(x).toBeLessThanOrEqual(
            FLOOR_CARD.width - ROTATION_INSET + 0.001,
          );
          expect(y).toBeGreaterThanOrEqual(ROTATION_INSET - 0.001);
          expect(y).toBeLessThanOrEqual(FLOOR_BOTTOM + 0.001);
        });
      },
    );
  });

  test('위에서 아래로 내려가며 회전 방향이 번갈아야 한다.', () => {
    const { placements } = layoutFloor(FULL_OUTFIT, SEED);
    const signs = [...placements]
      .sort((upper, lower) => upper.y - lower.y)
      .map(({ rotation }) => Math.sign(rotation));

    signs.slice(1).forEach((sign, index) => {
      expect(sign).toBe(-signs[index]);
    });
  });
});

describe('겹침 순서', () => {
  test('회전으로 겹칠 때 시안의 순서대로 쌓여야 한다.', () => {
    const items = createItems([
      'hat',
      'shoes',
      'socks',
      'bag',
      'outer',
      'top',
      'bottom',
    ]);
    const { placements } = layoutFloor(items, SEED);
    const stackOrders = [...placements]
      .sort((left, right) => Number(left.id) - Number(right.id))
      .map(({ stackOrder }) => stackOrder);

    expect(stackOrders).toEqual([7, 5, 4, 3, 2, 1, 0]);
  });
});

describe('대표 코디의 배치', () => {
  test('옷 3개 코디는 정해진 좌표에 놓여야 한다.', () => {
    const items = [
      { id: 'top', kind: 'top', ratio: 0.9 },
      { id: 'bottom', kind: 'bottom', ratio: 0.45 },
      { id: 'shoes', kind: 'shoes', ratio: 1.5 },
    ] satisfies FloorItem[];

    expect(layoutFloor(items, SEED).placements.map(roundPlacement)).toEqual(
      GOLDEN_THREE,
    );
  });

  test('소품이 많은 옷 6개 코디는 정해진 좌표와 겹침 순서로 놓여야 한다.', () => {
    const items = [
      { id: 'scarf', kind: 'scarf', ratio: 1.4 },
      { id: 'top', kind: 'top', ratio: 0.9 },
      { id: 'belt', kind: 'belt', ratio: 3 },
      { id: 'watch', kind: 'watch', ratio: 0.8 },
      { id: 'jewelry', kind: 'jewelry', ratio: 1 },
      { id: 'etc', kind: 'etc', ratio: 1.2 },
    ] satisfies FloorItem[];
    const { placements } = layoutFloor(items, { order: 3, id: 4103 });

    expect(placements.map(roundPlacement)).toEqual(GOLDEN_SIX);
    expect(
      Object.fromEntries(placements.map((item) => [item.id, item.stackOrder])),
    ).toEqual({
      scarf: 6,
      top: 1,
      belt: 6,
      watch: 8,
      jewelry: 8,
      etc: 8,
    });
  });

  test('옷 8개 코디는 정해진 좌표에 놓여야 한다.', () => {
    const items = [
      { id: 'hat', kind: 'hat', ratio: 1.3 },
      { id: 'eyewear', kind: 'eyewear', ratio: 2.4 },
      { id: 'outer', kind: 'outer', ratio: 0.8 },
      { id: 'top', kind: 'top', ratio: 0.9 },
      { id: 'bag', kind: 'bag', ratio: 1.1 },
      { id: 'bottom', kind: 'bottom', ratio: 0.42 },
      { id: 'socks', kind: 'socks', ratio: 0.7 },
      { id: 'shoes', kind: 'shoes', ratio: 1.6 },
    ] satisfies FloorItem[];

    expect(
      layoutFloor(items, { order: 2, id: 4102 }).placements.map(roundPlacement),
    ).toEqual(GOLDEN_EIGHT);
  });
});

describe('옷 종류', () => {
  test('옷 슬롯은 슬롯 그대로 종류가 되어야 한다.', () => {
    expect(
      getFloorItemKind({ slot_cd: 'outer', accessory_type_cd: null }),
    ).toBe('outer');
  });

  test('액세서리는 액세서리 종류를 따라야 한다.', () => {
    expect(
      getFloorItemKind({ slot_cd: 'accessories', accessory_type_cd: 'hat' }),
    ).toBe('hat');
  });

  test('종류를 모르는 액세서리는 기타로 봐야 한다.', () => {
    expect(
      getFloorItemKind({ slot_cd: 'accessories', accessory_type_cd: null }),
    ).toBe('etc');
  });
});
