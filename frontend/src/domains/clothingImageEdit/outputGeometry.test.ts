import { describe, expect, test } from 'vitest';
import type { Quad } from './types';
import { DEFAULT_CORNERS } from './perspective';
import { getOutputGeometry, mapOutputToSource } from './outputGeometry';

const SOURCE = { width: 400, height: 600 };

const expectPoint = (
  actual: readonly [number, number],
  expected: readonly [number, number],
) => {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
};

describe('출력 기하', () => {
  test('편집하지 않았으면 출력 좌표가 원본 좌표와 같아야 한다.', () => {
    const geometry = getOutputGeometry(SOURCE, DEFAULT_CORNERS, 0);

    expect(geometry?.outputSize).toEqual(SOURCE);
    if (geometry === null) {
      return;
    }

    expectPoint(mapOutputToSource(geometry, [0, 0]), [0, 0]);
    expectPoint(mapOutputToSource(geometry, [123, 456]), [123, 456]);
  });

  test('시계 방향 90°면 출력 오른쪽 위가 원본 왼쪽 위여야 한다.', () => {
    const geometry = getOutputGeometry(SOURCE, DEFAULT_CORNERS, 90);

    expect(geometry?.outputSize).toEqual({ width: 600, height: 400 });
    if (geometry === null) {
      return;
    }

    expectPoint(mapOutputToSource(geometry, [600, 0]), [0, 0]);
    expectPoint(mapOutputToSource(geometry, [600, 400]), [400, 0]);
    expectPoint(mapOutputToSource(geometry, [0, 0]), [0, 600]);
  });

  test('원근을 쓰면 출력 네 귀퉁이가 원본 꼭짓점으로 가야 한다.', () => {
    const corners: Quad = [
      [0.1, 0.05],
      [0.9, 0],
      [1, 1],
      [0, 0.95],
    ];
    const geometry = getOutputGeometry(SOURCE, corners, 0);

    expect(geometry).not.toBeNull();
    if (geometry === null) {
      return;
    }

    const { width, height } = geometry.outputSize;

    expectPoint(mapOutputToSource(geometry, [0, 0]), [40, 30]);
    expectPoint(mapOutputToSource(geometry, [width, 0]), [360, 0]);
    expectPoint(mapOutputToSource(geometry, [width, height]), [400, 600]);
    expectPoint(mapOutputToSource(geometry, [0, height]), [0, 570]);
  });

  test('원근 뒤에 회전해야 한다.', () => {
    const corners: Quad = [
      [0.1, 0.05],
      [0.9, 0],
      [1, 1],
      [0, 0.95],
    ];
    const geometry = getOutputGeometry(SOURCE, corners, 90);

    expect(geometry).not.toBeNull();
    if (geometry === null) {
      return;
    }

    const { width } = geometry.outputSize;

    // 90° 돌린 결과의 오른쪽 위는 원근을 편 그림의 왼쪽 위, 곧 원본의 좌상 꼭짓점이다.
    expectPoint(mapOutputToSource(geometry, [width, 0]), [40, 30]);
  });
});
