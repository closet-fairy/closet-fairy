import { describe, expect, test } from 'vitest';
import { CYCLE_MS } from './ClothesWandVisual.constants';
import { CLOTHES_WAND_LAYOUTS } from './ClothesWandVisual.layout';
import getClothesWandFrame from './getClothesWandFrame';

const APPAREL = 0;
const DRY_CLEANING = 1;
const WATCH = 5;

describe('첫 주기', () => {
  test('시작할 때는 첫 옷만 작고 투명한 채 제자리에 있고, 요술봉과 점은 움직이지 않아야 한다.', () => {
    const frame = getClothesWandFrame(0, false);

    expect(frame.clothes[APPAREL]).toEqual({ opacity: 0, scale: 0.55 });
    expect(frame.clothes.filter(({ opacity }) => opacity > 0)).toHaveLength(0);
    expect(frame.wand).toEqual({
      left: CLOTHES_WAND_LAYOUTS.apparel.wand.left,
      top: CLOTHES_WAND_LAYOUTS.apparel.wand.top,
      angle: 0,
    });
    expect(frame.dots).toBeNull();
  });

  test('0.3초에 옷이 크기 1, 투명도 1이 되고 이전 옷은 없어야 한다.', () => {
    const frame = getClothesWandFrame(300, false);

    expect(frame.clothes[APPAREL]).toEqual({ opacity: 1, scale: 1 });
    expect(frame.clothes[WATCH].opacity).toBe(0);
  });

  test('튀어나올 때 크기가 1을 살짝 넘겼다가 돌아와야 한다.', () => {
    const scales = [60, 120, 180, 240].map(
      (ms) => getClothesWandFrame(ms, false).clothes[APPAREL].scale,
    );

    expect(Math.max(...scales)).toBeGreaterThan(1);
    expect(Math.max(...scales)).toBeLessThan(1.15);
  });

  test('요술봉은 1.36초부터 뒤로 젖혀 1.79초에 -16도가 되어야 한다.', () => {
    expect(getClothesWandFrame(1360, false).wand.angle).toBe(0);
    expect(getClothesWandFrame(1575, false).wand.angle).toBeCloseTo(-8);
    expect(getClothesWandFrame(1790, false).wand.angle).toBeCloseTo(-16);
  });

  test('톡 치는 구간의 끝에서 +14도에 닿아야 한다.', () => {
    expect(getClothesWandFrame(CYCLE_MS - 1, false).wand.angle).toBeCloseTo(
      14,
      0,
    );
    expect(getClothesWandFrame(CYCLE_MS, false).wand.angle).toBe(14);
  });
});

describe('옷이 바뀌는 순간', () => {
  test('이전 옷은 0.16초 동안 크기 0.7, 투명도 0까지 사라지고 새 옷이 나타나야 한다.', () => {
    const start = getClothesWandFrame(CYCLE_MS, false);
    const end = getClothesWandFrame(CYCLE_MS + 160, false);

    expect(start.clothes[APPAREL]).toEqual({ opacity: 1, scale: 1 });
    expect(start.clothes[DRY_CLEANING]).toEqual({ opacity: 0, scale: 0.55 });
    expect(end.clothes[APPAREL].opacity).toBe(0);
    expect(end.clothes[APPAREL].scale).toBeCloseTo(0.7);
  });

  test('요술봉은 +14도에서 0.44초에 걸쳐 0도로 돌아와야 한다.', () => {
    expect(getClothesWandFrame(CYCLE_MS, false).wand.angle).toBe(14);
    expect(getClothesWandFrame(CYCLE_MS + 440, false).wand.angle).toBeCloseTo(
      0,
    );
  });

  test('요술봉은 0.56초에 걸쳐 이전 옷의 자리에서 새 옷의 자리로 옮겨 가야 한다.', () => {
    const start = getClothesWandFrame(CYCLE_MS, false).wand;
    const middle = getClothesWandFrame(CYCLE_MS + 280, false).wand;
    const end = getClothesWandFrame(CYCLE_MS + 560, false).wand;
    const from = CLOTHES_WAND_LAYOUTS.apparel.wand;
    const to = CLOTHES_WAND_LAYOUTS.dry_cleaning.wand;

    expect(start.left).toBeCloseTo(from.left);
    expect(start.top).toBeCloseTo(from.top);
    expect(middle.left).toBeCloseTo((from.left + to.left) / 2);
    expect(middle.top).toBeCloseTo((from.top + to.top) / 2);
    expect(end.left).toBeCloseTo(to.left);
    expect(end.top).toBeCloseTo(to.top);
  });

  test('6개를 한 바퀴 돈 뒤에는 처음 옷으로 돌아오고 이전 옷은 마지막 옷이어야 한다.', () => {
    const frame = getClothesWandFrame(CYCLE_MS * 6, false);

    expect(frame.clothes[APPAREL]).toEqual({ opacity: 0, scale: 0.55 });
    expect(frame.clothes[WATCH]).toEqual({ opacity: 1, scale: 1 });
  });
});

describe('점 퍼짐', () => {
  test('치는 순간에는 이전 옷 기준 별 끝에서 5개가 지름 4px로 출발해야 한다.', () => {
    const { dots } = getClothesWandFrame(CYCLE_MS, false);
    const { tip } = CLOTHES_WAND_LAYOUTS.apparel;

    expect(dots).toHaveLength(5);

    dots?.forEach(({ x, y, opacity, scale }) => {
      expect(Math.hypot(x + 2 - tip.x, y + 2 - tip.y)).toBeCloseTo(4);
      expect(opacity).toBe(1);
      expect(scale).toBe(1);
    });
  });

  test('왼쪽 위를 중심으로 -80, -40, 0, 40, 80도 방향으로 퍼져야 한다.', () => {
    const { dots } = getClothesWandFrame(CYCLE_MS + 210, false);
    const { tip } = CLOTHES_WAND_LAYOUTS.apparel;
    const angles = dots?.map(({ x, y }) =>
      Math.round((Math.atan2(y + 2 - tip.y, x + 2 - tip.x) * 180) / Math.PI),
    );

    // atan2는 -180~180도로 돌려주므로 -215도는 145도로 나온다.
    expect(angles).toEqual([145, -175, -135, -95, -55]);
  });

  test('하나 걸러 18px과 24px까지 퍼지며 0.42초에 사라져야 한다.', () => {
    const { dots } = getClothesWandFrame(CYCLE_MS + 419, false);
    const { tip } = CLOTHES_WAND_LAYOUTS.apparel;
    const distances = dots?.map(({ x, y }) =>
      Math.round(Math.hypot(x + 2 - tip.x, y + 2 - tip.y)),
    );

    expect(distances).toEqual([18, 24, 18, 24, 18]);
    expect(dots?.every(({ scale }) => scale < 0.41)).toBe(true);
    expect(getClothesWandFrame(CYCLE_MS + 420, false).dots).toBeNull();
  });
});

describe('움직임 줄이기', () => {
  test('옷은 크기 변화 없이 서서히 바뀌고 요술봉은 움직이지 않으며 점은 없어야 한다.', () => {
    const frame = getClothesWandFrame(CYCLE_MS + 150, true);

    expect(frame.clothes.every(({ scale }) => scale === 1)).toBe(true);
    expect(frame.clothes[APPAREL].opacity).toBeCloseTo(0.5);
    expect(frame.clothes[DRY_CLEANING].opacity).toBeCloseTo(0.5);
    expect(frame.wand).toEqual({
      left: CLOTHES_WAND_LAYOUTS.dry_cleaning.wand.left,
      top: CLOTHES_WAND_LAYOUTS.dry_cleaning.wand.top,
      angle: 0,
    });
    expect(frame.dots).toBeNull();
    expect(getClothesWandFrame(1790, true).wand.angle).toBe(0);
  });
});
