/*
 * scripts/computeClothesWandLayout.ts가 만든 파일이다. 직접 고치지 않는다.
 * 값은 190px 상자의 왼쪽 위를 원점으로 하는 px이다.
 *   clothes: 80px 옷 아이콘 상자의 left, top
 *   wand: 36px 요술봉 상자의 left, top (좌우 반전 전 상자 기준)
 *   tip: 좌우 반전한 요술봉의 별 끝 좌표
 */
export const LAYOUT_BOX_SIZE = 190;
export const LAYOUT_CLOTHES_SIZE = 80;
export const LAYOUT_WAND_SIZE = 36;

export const CLOTHES_WAND_LAYOUTS = {
  apparel: {
    clothes: { left: 48.85, top: 40.9 },
    wand: { left: 104.53, top: 107.6 },
    tip: { x: 109.82, y: 112.89 },
  },
  dry_cleaning: {
    clothes: { left: 47.06, top: 40.39 },
    wand: { left: 101.44, top: 111.44 },
    tip: { x: 106.73, y: 116.73 },
  },
  steps: {
    clothes: { left: 42.78, top: 42.44 },
    wand: { left: 108.91, top: 108.57 },
    tip: { x: 114.19, y: 113.86 },
  },
  shopping_bag: {
    clothes: { left: 41.14, top: 41.14 },
    wand: { left: 104.02, top: 110.69 },
    tip: { x: 109.31, y: 115.98 },
  },
  eyeglasses: {
    clothes: { left: 43.97, top: 41.45 },
    wand: { left: 111.2, top: 93.72 },
    tip: { x: 116.48, y: 99 },
  },
  watch: {
    clothes: { left: 47.31, top: 40.39 },
    wand: { left: 94.52, top: 111.44 },
    tip: { x: 99.81, y: 116.73 },
  },
} as const;
