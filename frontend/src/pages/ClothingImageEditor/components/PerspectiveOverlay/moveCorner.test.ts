import { describe, expect, test } from 'vitest';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import type { Point, Quad } from '@/domains/clothingImageEdit/types';
import { getViewCorners, moveCorner, pickCorner } from './moveCorner';

const BOX_SIZE = { width: 200, height: 100 };

const expectPoint = (actual: Point | undefined, expected: Point) => {
  expect(actual?.[0]).toBeCloseTo(expected[0]);
  expect(actual?.[1]).toBeCloseTo(expected[1]);
};

describe('꼭짓점 고르기', () => {
  test('반지름 22px 안에 있는 꼭짓점을 골라야 한다.', () => {
    const grabbed = pickCorner(DEFAULT_CORNERS, [0.05, 0.05], BOX_SIZE);

    expect(grabbed?.index).toBe(0);
  });

  test('반지름 22px 밖을 누르면 아무 꼭짓점도 고르지 않아야 한다.', () => {
    expect(pickCorner(DEFAULT_CORNERS, [0.12, 0], BOX_SIZE)).toBeNull();
  });

  test('잡는 영역이 겹치면 가장 가까운 꼭짓점을 골라야 한다.', () => {
    const corners: Quad = [
      [0.5, 0.5],
      [0.6, 0.5],
      [0.6, 0.9],
      [0.5, 0.9],
    ];

    expect(pickCorner(corners, [0.57, 0.5], BOX_SIZE)?.index).toBe(1);
    expect(pickCorner(corners, [0.53, 0.5], BOX_SIZE)?.index).toBe(0);
  });

  test('고른 꼭짓점과 포인터 사이의 간격을 함께 알려야 한다.', () => {
    const grabbed = pickCorner(DEFAULT_CORNERS, [0.98, 0.96], BOX_SIZE);

    expect(grabbed?.index).toBe(2);
    expectPoint(grabbed?.offset, [0.02, 0.04]);
  });
});

describe('꼭짓점 옮기기', () => {
  test('처음 잡은 간격을 유지한 채 포인터를 따라가야 한다.', () => {
    const nextCorners = moveCorner({
      corners: DEFAULT_CORNERS,
      quarterTurns: 0,
      index: 2,
      pointer: [0.78, 0.86],
      offset: [0.02, 0.04],
      boxSize: BOX_SIZE,
    });

    expectPoint(nextCorners?.[2], [0.8, 0.9]);
    expect(nextCorners?.[0]).toEqual(DEFAULT_CORNERS[0]);
  });

  test('사진 밖으로 끌면 사진 경계에서 멈춰야 한다.', () => {
    const nextCorners = moveCorner({
      corners: DEFAULT_CORNERS,
      quarterTurns: 0,
      index: 1,
      pointer: [1.3, -0.2],
      offset: [0, 0],
      boxSize: BOX_SIZE,
    });

    expect(nextCorners?.[1]).toEqual([1, 0]);
  });

  test('사각형이 오목해지는 위치로는 옮기지 않아야 한다.', () => {
    const nextCorners = moveCorner({
      corners: DEFAULT_CORNERS,
      quarterTurns: 0,
      index: 0,
      pointer: [0.8, 0.9],
      offset: [0, 0],
      boxSize: BOX_SIZE,
    });

    expect(nextCorners).toBeNull();
  });

  test('사각형이 꼬이는 위치로는 옮기지 않아야 한다.', () => {
    const corners: Quad = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.8, 0.8],
      [0.2, 0.8],
    ];
    const nextCorners = moveCorner({
      corners,
      quarterTurns: 0,
      index: 0,
      pointer: [0.95, 0.3],
      offset: [0, 0],
      boxSize: BOX_SIZE,
    });

    expect(nextCorners).toBeNull();
  });

  test('변이 최소 길이보다 짧아지는 위치로는 옮기지 않아야 한다.', () => {
    const nextCorners = moveCorner({
      corners: DEFAULT_CORNERS,
      quarterTurns: 0,
      index: 0,
      pointer: [0.97, 0],
      offset: [0, 0],
      boxSize: BOX_SIZE,
    });

    expect(nextCorners).toBeNull();
  });
});

describe('90° 방향 좌표 변환', () => {
  const TURNED_BOX_SIZE = { width: 100, height: 200 };

  test('누끼 기준 꼭짓점을 시계 방향으로 돌린 화면 좌표로 바꿔야 한다.', () => {
    const viewCorners = getViewCorners(DEFAULT_CORNERS, 1);

    expect(viewCorners).toEqual([
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
  });

  test('돌린 화면에서 잡은 꼭짓점은 누끼 기준 꼭짓점이어야 한다.', () => {
    const grabbed = pickCorner(
      getViewCorners(DEFAULT_CORNERS, 1),
      [0.98, 0.02],
      TURNED_BOX_SIZE,
    );

    expect(grabbed?.index).toBe(0);
  });

  test('돌린 화면에서 끈 자리를 누끼 기준 좌표로 되돌려 저장해야 한다.', () => {
    const nextCorners = moveCorner({
      corners: DEFAULT_CORNERS,
      quarterTurns: 1,
      index: 0,
      pointer: [0.88, 0.12],
      offset: [0.02, -0.02],
      boxSize: TURNED_BOX_SIZE,
    });

    expectPoint(nextCorners?.[0], [0.1, 0.1]);
    expect(nextCorners?.[2]).toEqual(DEFAULT_CORNERS[2]);
  });
});
