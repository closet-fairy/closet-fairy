import type { Matrix3, Quad, Size } from './types';
import {
  getPerspectiveOutputSize,
  getPerspectiveTransform,
} from './perspective';

import { getRotatedBounds } from './rotation';

export interface OutputGeometry {
  outputSize: Size;
  perspectiveSize: Size;
  // 출력 픽셀 좌표에서 회전을 거꾸로 풀 때 쓰는 cos, sin이다.
  inverseRotation: readonly [number, number];
  // 원근을 편 그림의 픽셀 좌표를 원본(작업 크기) 픽셀 좌표로 옮기는 행렬이다.
  perspectiveToSource: Matrix3;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/*
 * 처리 순서는 마스크 → 원근 → 회전이다.
 * 출력 픽셀마다 회전을 거꾸로 풀고, 원근을 거꾸로 풀어 원본 픽셀을 찾는다.
 */
export const getOutputGeometry = (
  sourceSize: Size,
  corners: Quad,
  angle: number,
): OutputGeometry | null => {
  const perspectiveSize = getPerspectiveOutputSize(corners, sourceSize);
  const outputSize = getRotatedBounds(perspectiveSize, angle);
  const perspectiveToSource = getPerspectiveTransform(
    [
      [0, 0],
      [perspectiveSize.width, 0],
      [perspectiveSize.width, perspectiveSize.height],
      [0, perspectiveSize.height],
    ],
    [
      [corners[0][0] * sourceSize.width, corners[0][1] * sourceSize.height],
      [corners[1][0] * sourceSize.width, corners[1][1] * sourceSize.height],
      [corners[2][0] * sourceSize.width, corners[2][1] * sourceSize.height],
      [corners[3][0] * sourceSize.width, corners[3][1] * sourceSize.height],
    ],
  );

  if (perspectiveToSource === null) {
    return null;
  }

  const radians = toRadians(angle);

  return {
    outputSize,
    perspectiveSize,
    inverseRotation: [Math.cos(radians), Math.sin(radians)],
    perspectiveToSource,
  };
};

const EDGE_TOLERANCE = 1e-6;

/*
 * 출력 픽셀 좌표(왼쪽 위 원점, y 아래로)를 원본 픽셀 좌표로 바꾼다. 비어 있어야 할 자리면 null이다.
 * 원근을 편 사각형 밖은 잘려 나간 부분이라, 회전으로 커진 귀퉁이에 비치지 않게 막는다.
 * 셰이더와 같은 계산이라, 셰이더를 고칠 때 이 함수와 테스트도 함께 맞춘다.
 */
export const mapOutputToSource = (
  geometry: OutputGeometry,
  outputPoint: readonly [number, number],
): readonly [number, number] | null => {
  const { outputSize, perspectiveSize, inverseRotation, perspectiveToSource } =
    geometry;
  const [cos, sin] = inverseRotation;
  const dx = outputPoint[0] - outputSize.width / 2;
  const dy = outputPoint[1] - outputSize.height / 2;
  const x = cos * dx + sin * dy + perspectiveSize.width / 2;
  const y = -sin * dx + cos * dy + perspectiveSize.height / 2;

  if (
    x < -EDGE_TOLERANCE ||
    y < -EDGE_TOLERANCE ||
    x > perspectiveSize.width + EDGE_TOLERANCE ||
    y > perspectiveSize.height + EDGE_TOLERANCE
  ) {
    return null;
  }

  const [a, b, c, d, e, f, g, h, i] = perspectiveToSource;
  const w = g * x + h * y + i;

  if (w <= 0) {
    return null;
  }

  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
};

// GLSL의 mat3는 열 우선이라 행 우선 행렬을 전치해서 넘긴다.
export const toColumnMajor = (matrix: Matrix3) => {
  const [a, b, c, d, e, f, g, h, i] = matrix;

  return new Float32Array([a, d, g, b, e, h, c, f, i]);
};
