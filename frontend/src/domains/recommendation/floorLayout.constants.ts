import type { OutfitItemResult } from '@/generated/models';

export type FloorItemKind =
  | Exclude<OutfitItemResult['slot_cd'], 'accessories'>
  | NonNullable<OutfitItemResult['accessory_type_cd']>;

export type FloorItemGrade = 'large' | 'medium' | 'small';

export const FLOOR_CARD = {
  width: 362,
  height: 568,
  edge: 14,
  gap: 10,
  reservedBottom: 56,
  wideColumnShare: 0.54,
} as const;

export const MAX_FLOOR_ITEMS = 8;

export const FLOOR_ITEM_GRADE: Record<FloorItemKind, FloorItemGrade> = {
  outer: 'large',
  top: 'large',
  bottom: 'large',
  shoes: 'medium',
  bag: 'medium',
  socks: 'small',
  hat: 'small',
  belt: 'small',
  watch: 'small',
  scarf: 'small',
  eyewear: 'small',
  jewelry: 'small',
  etc: 'small',
};

export const TARGET_AREA: Record<FloorItemGrade, number> = {
  large: 30000,
  medium: 10000,
  small: 4000,
};

export const MAX_SCALE: Record<FloorItemGrade, number> = {
  large: 1.3,
  medium: 1.1,
  small: 1,
};

export const PRIORITY: Record<FloorItemKind, number> = {
  top: 0,
  bottom: 0,
  shoes: 0,
  outer: 1,
  hat: 2,
  bag: 3,
  socks: 4,
  scarf: 5,
  eyewear: 5,
  belt: 5,
  watch: 5,
  jewelry: 6,
  etc: 6,
};

// 시안의 머리에서 발 순서다. 시안에 없는 주얼리·기타는 가방·벨트·시계와 같은 층으로 둔다.
export const FLOW: Record<FloorItemKind, number> = {
  hat: 0,
  eyewear: 0,
  outer: 1,
  top: 1,
  scarf: 1,
  bag: 2,
  belt: 2,
  watch: 2,
  jewelry: 2,
  etc: 2,
  bottom: 3,
  socks: 4,
  shoes: 4,
};

export const FLOW_TIE: Record<FloorItemKind, number> = {
  hat: 0,
  eyewear: 1,
  top: 0,
  outer: 1,
  scarf: 2,
  bag: 0,
  belt: 1,
  watch: 2,
  jewelry: 3,
  etc: 4,
  bottom: 0,
  socks: 0,
  shoes: 1,
};

export const STACK_ORDER: Record<FloorItemKind, number> = {
  bottom: 0,
  top: 1,
  outer: 2,
  bag: 3,
  socks: 4,
  shoes: 5,
  scarf: 6,
  belt: 6,
  hat: 7,
  eyewear: 8,
  watch: 8,
  jewelry: 8,
  etc: 8,
};

export const MIN_ACHIEVEMENT_WEIGHT = 0.5;
export const INVERSION_WEIGHT = 0.12;
export const INVERSION_SLACK = 30;
export const WIDE_COLUMN_WEIGHT = 0.15;
export const END_GAP_WEIGHT = 0.03;
export const FILL_WEIGHT = 0.02;
export const VARIETY_TOLERANCE = 0.03;

export const SPARSE_TARGET_AREA = 56000;
export const MAX_SPARSE_BOOST = 4;

export const MAX_ROTATION = 6;
export const MIN_ROTATION_SHARE = 0.4;
export const ROTATION_INSET = 4;
