import { describe, expect, test } from 'vitest';
import {
  clampView,
  DEFAULT_BRUSH_VIEW,
  getPinchView,
  getWheelPixels,
  getWheelZoomFactor,
  MAX_ZOOM,
  panBy,
  toMaskPoint,
  zoomAt,
} from './brushView';
import type { BrushGeometry } from './brushView';

// 500×400 표면 가운데에 200×100 마스크를 2배로 그린 상황이다. 그림은 (50, 100)~(450, 300)이다.
const GEOMETRY: BrushGeometry = {
  center: [250, 200],
  displayScale: 2,
  quarterTurns: 0,
  maskSize: { width: 200, height: 100 },
};

const ZOOMED_VIEW = { zoom: 2, x: -250, y: -200 };

describe('화면 → 마스크 좌표', () => {
  test('1배에서는 그림 귀퉁이와 가운데가 마스크 귀퉁이와 가운데로 가야 한다.', () => {
    expect(toMaskPoint([50, 100], DEFAULT_BRUSH_VIEW, GEOMETRY)).toEqual([
      0, 0,
    ]);
    expect(toMaskPoint([450, 300], DEFAULT_BRUSH_VIEW, GEOMETRY)).toEqual([
      200, 100,
    ]);
    expect(toMaskPoint([250, 200], DEFAULT_BRUSH_VIEW, GEOMETRY)).toEqual([
      100, 50,
    ]);
  });

  test('확대·이동을 풀어 계산해야 한다.', () => {
    expect(toMaskPoint([250, 200], ZOOMED_VIEW, GEOMETRY)).toEqual([100, 50]);
    expect(toMaskPoint([450, 200], ZOOMED_VIEW, GEOMETRY)).toEqual([150, 50]);
  });

  test('90° 돌린 그림에서는 원래 방향의 마스크 좌표로 바꿔야 한다.', () => {
    const turned: BrushGeometry = {
      ...GEOMETRY,
      center: [250, 250],
      quarterTurns: 1,
    };

    // 시계 방향으로 돌린 그림의 왼쪽 위는 원래 그림의 왼쪽 아래다.
    expect(toMaskPoint([150, 50], DEFAULT_BRUSH_VIEW, turned)).toEqual([
      0, 100,
    ]);
    expect(toMaskPoint([350, 50], DEFAULT_BRUSH_VIEW, turned)).toEqual([0, 0]);
  });

  test('그림 밖의 점은 마스크 밖 좌표로 나와야 한다.', () => {
    const [x] = toMaskPoint([10, 200], DEFAULT_BRUSH_VIEW, GEOMETRY);

    expect(x).toBeLessThan(0);
  });
});

describe('이동 자르기', () => {
  test('1배에서는 가운데에 고정되어야 한다.', () => {
    expect(clampView({ zoom: 1, x: 80, y: -40 }, GEOMETRY)).toEqual(
      DEFAULT_BRUSH_VIEW,
    );
  });

  test('확대하면 가장자리가 1배일 때의 자리까지만 움직일 수 있어야 한다.', () => {
    expect(clampView({ zoom: 2, x: 0, y: 0 }, GEOMETRY)).toEqual({
      zoom: 2,
      x: -50,
      y: -100,
    });
    expect(clampView({ zoom: 2, x: -900, y: -900 }, GEOMETRY)).toEqual({
      zoom: 2,
      x: -450,
      y: -300,
    });
  });

  test('이동량을 더한 뒤 같은 범위로 잘라야 한다.', () => {
    expect(panBy(ZOOMED_VIEW, 100, 0, GEOMETRY)).toEqual({
      zoom: 2,
      x: -150,
      y: -200,
    });
    expect(panBy(ZOOMED_VIEW, 1000, 0, GEOMETRY).x).toBe(-50);
  });
});

describe('커서 기준 확대', () => {
  test('커서 아래의 마스크 점이 확대 뒤에도 커서 아래에 남아야 한다.', () => {
    const anchor = [150, 200] as const;
    const before = toMaskPoint(anchor, DEFAULT_BRUSH_VIEW, GEOMETRY);
    const zoomed = zoomAt(DEFAULT_BRUSH_VIEW, 2, anchor, GEOMETRY);

    expect(zoomed).toEqual({ zoom: 2, x: -150, y: -200 });
    expect(toMaskPoint(anchor, zoomed, GEOMETRY)).toEqual(before);
  });

  test('확대율은 1~8배로 잘라야 한다.', () => {
    expect(zoomAt(DEFAULT_BRUSH_VIEW, 20, [250, 200], GEOMETRY).zoom).toBe(
      MAX_ZOOM,
    );
    expect(zoomAt(ZOOMED_VIEW, 0.2, [250, 200], GEOMETRY)).toEqual(
      DEFAULT_BRUSH_VIEW,
    );
  });
});

describe('두 손가락 확대·이동', () => {
  test('손가락 사이가 두 배로 벌어지면 가운데 점 기준으로 두 배 확대해야 한다.', () => {
    expect(
      getPinchView(
        DEFAULT_BRUSH_VIEW,
        [
          [200, 200],
          [300, 200],
        ],
        [
          [150, 200],
          [350, 200],
        ],
        GEOMETRY,
      ),
    ).toEqual({ zoom: 2, x: -250, y: -200 });
  });

  test('거리를 유지하고 움직이면 가운데 점을 따라 이동해야 한다.', () => {
    expect(
      getPinchView(
        ZOOMED_VIEW,
        [
          [200, 200],
          [300, 200],
        ],
        [
          [250, 230],
          [350, 230],
        ],
        GEOMETRY,
      ),
    ).toEqual({ zoom: 2, x: -200, y: -170 });
  });
});

describe('휠', () => {
  test('줄·쪽 단위 변화량을 px로 바꿔야 한다.', () => {
    expect(getWheelPixels(3, 0, 500)).toBe(3);
    expect(getWheelPixels(3, 1, 500)).toBe(48);
    expect(getWheelPixels(1, 2, 500)).toBe(500);
  });

  test('휠을 위로 굴리면 확대하고, 한 번의 변화량은 제한해야 한다.', () => {
    expect(getWheelZoomFactor(-10)).toBeGreaterThan(1);
    expect(getWheelZoomFactor(10)).toBeLessThan(1);
    expect(getWheelZoomFactor(-1000)).toBeCloseTo(getWheelZoomFactor(-50));
  });
});
