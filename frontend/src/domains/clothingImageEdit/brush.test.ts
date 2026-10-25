import { describe, expect, test } from 'vitest';
import {
  advanceStamps,
  getBrushRadius,
  getStampSpacing,
  getStampsBounds,
  unionRects,
} from './brush';
import type { StampCursor } from './brush';

const MASK_SIZE = { width: 100, height: 80 };

describe('붓 크기', () => {
  test('화면 지름을 표시 배율과 확대율로 나눠 마스크 반지름으로 바꿔야 한다.', () => {
    expect(getBrushRadius(20, 0.5, 1)).toBe(20);
    expect(getBrushRadius(20, 0.5, 4)).toBe(5);
  });

  test('도장 간격은 반지름의 25%여야 하고, 너무 작아지지 않아야 한다.', () => {
    expect(getStampSpacing(20)).toBe(5);
    expect(getStampSpacing(0.4)).toBe(0.5);
  });
});

describe('점 보간', () => {
  test('첫 점은 그 자리에 도장을 찍어야 한다.', () => {
    const { stamps, cursor } = advanceStamps(null, [10, 10], 5);

    expect(stamps).toEqual([[10, 10]]);
    expect(cursor).toEqual({ point: [10, 10], carry: 0 });
  });

  test('두 점 사이를 같은 간격으로 메워야 한다.', () => {
    const cursor: StampCursor = { point: [0, 0], carry: 0 };
    const { stamps, cursor: next } = advanceStamps(cursor, [12, 0], 5);

    expect(stamps).toEqual([
      [5, 0],
      [10, 0],
    ]);
    expect(next.carry).toBeCloseTo(2);
  });

  test('간격보다 짧게 움직이면 거리를 모아 두었다가 다음에 이어 찍어야 한다.', () => {
    const first = advanceStamps({ point: [0, 0], carry: 0 }, [3, 0], 5);
    const second = advanceStamps(first.cursor, [6, 0], 5);

    expect(first.stamps).toEqual([]);
    expect(second.stamps).toEqual([[5, 0]]);
  });

  test('제자리 이동은 도장을 찍지 않아야 한다.', () => {
    const cursor: StampCursor = { point: [4, 4], carry: 1 };

    expect(advanceStamps(cursor, [4, 4], 5)).toEqual({ stamps: [], cursor });
  });
});

describe('칠한 영역', () => {
  test('도장 범위를 정수 사각형으로 감싸야 한다.', () => {
    expect(
      getStampsBounds(
        [
          [10.5, 20],
          [30, 25.2],
        ],
        3,
        MASK_SIZE,
      ),
    ).toEqual({ x: 7, y: 17, width: 26, height: 12 });
  });

  test('마스크 경계 밖은 잘라 내야 한다.', () => {
    expect(getStampsBounds([[2, 78]], 5, MASK_SIZE)).toEqual({
      x: 0,
      y: 73,
      width: 7,
      height: 7,
    });
  });

  test('마스크와 겹치지 않으면 null이어야 한다.', () => {
    expect(getStampsBounds([[-20, -20]], 5, MASK_SIZE)).toBeNull();
    expect(getStampsBounds([], 5, MASK_SIZE)).toBeNull();
  });

  test('두 사각형을 모두 감싸는 사각형으로 합쳐야 한다.', () => {
    expect(
      unionRects(
        { x: 0, y: 10, width: 5, height: 5 },
        { x: 20, y: 0, width: 4, height: 4 },
      ),
    ).toEqual({ x: 0, y: 0, width: 24, height: 15 });
    expect(unionRects(null, { x: 1, y: 1, width: 1, height: 1 })).toEqual({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
    });
  });
});
