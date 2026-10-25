import { describe, expect, test } from 'vitest';
import {
  toSourcePoint,
  getQuarterTurnedSize,
  getRotatedBounds,
  toViewPoint,
} from './rotation';

describe('회전 후 캔버스 크기', () => {
  test('0°면 크기가 그대로여야 한다.', () => {
    expect(getRotatedBounds({ width: 1000, height: 1500 }, 0)).toEqual({
      width: 1000,
      height: 1500,
    });
  });

  test('90°면 가로와 세로가 정확히 맞바뀌어야 한다.', () => {
    expect(getRotatedBounds({ width: 1000, height: 1500 }, 90)).toEqual({
      width: 1500,
      height: 1000,
    });
    expect(getRotatedBounds({ width: 1000, height: 1500 }, -90)).toEqual({
      width: 1500,
      height: 1000,
    });
  });

  test('조금만 돌려도 그림이 잘리지 않게 올려 잡아야 한다.', () => {
    expect(getRotatedBounds({ width: 1000, height: 1500 }, 0.01)).toEqual({
      width: 1001,
      height: 1501,
    });
  });

  test('비스듬히 돌리면 그림이 다 들어가도록 커져야 한다.', () => {
    expect(getRotatedBounds({ width: 1000, height: 1500 }, 30)).toEqual({
      width: 1617,
      height: 1800,
    });
  });
});

describe('90° 단위 화면 좌표', () => {
  test('90° 돌린 화면의 크기는 가로세로가 바뀌어야 한다.', () => {
    expect(getQuarterTurnedSize({ width: 300, height: 400 }, 1)).toEqual({
      width: 400,
      height: 300,
    });
    expect(getQuarterTurnedSize({ width: 300, height: 400 }, 2)).toEqual({
      width: 300,
      height: 400,
    });
  });

  test('시계 방향 90°면 원본 왼쪽 위가 화면 오른쪽 위로 가야 한다.', () => {
    expect(toViewPoint([0, 0], 1)).toEqual([1, 0]);
    expect(toViewPoint([1, 0], 1)).toEqual([1, 1]);
  });

  test('180°와 270°도 원본 왼쪽 위가 제자리로 가야 한다.', () => {
    expect(toViewPoint([0, 0], 2)).toEqual([1, 1]);
    expect(toViewPoint([0, 0], 3)).toEqual([0, 1]);
  });

  test('화면 좌표를 거꾸로 풀면 원본 좌표로 돌아와야 한다.', () => {
    [-2, -1, 0, 1, 2, 3, 5].forEach((quarterTurns) => {
      const point = [0.2, 0.7] as const;
      const restored = toSourcePoint(
        toViewPoint(point, quarterTurns),
        quarterTurns,
      );

      expect(restored[0]).toBeCloseTo(0.2);
      expect(restored[1]).toBeCloseTo(0.7);
    });
  });
});
