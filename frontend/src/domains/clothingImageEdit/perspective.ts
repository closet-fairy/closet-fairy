import type { Matrix3, Point, Quad, Size } from './types';

export const DEFAULT_CORNERS: Quad = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

// 꼭짓점을 잡았다 놓기만 해도 미세하게 움직이므로, 귀퉁이에서 0.1% 이내면 원근을 쓰지 않은 것으로 본다.
const DEFAULT_CORNER_TOLERANCE = 0.001 + 1e-9;

export const isDefaultCorners = (corners: Quad) =>
  corners.every(
    (corner, index) =>
      Math.abs(corner[0] - DEFAULT_CORNERS[index][0]) <=
        DEFAULT_CORNER_TOLERANCE &&
      Math.abs(corner[1] - DEFAULT_CORNERS[index][1]) <=
        DEFAULT_CORNER_TOLERANCE,
  );

// 렌더링과 저장이 같은 꼭짓점을 쓰도록, 기본값으로 볼 만큼 가까우면 기본값으로 붙인다.
export const snapCorners = (corners: Quad): Quad =>
  isDefaultCorners(corners) ? DEFAULT_CORNERS : corners;

type MutablePoint = [number, number];

export interface PerspectiveParamValue {
  corners: [MutablePoint, MutablePoint, MutablePoint, MutablePoint];
}

export const toPerspectiveParam = (
  corners: Quad,
): PerspectiveParamValue | null => {
  if (isDefaultCorners(corners)) {
    return null;
  }

  const [topLeft, topRight, bottomRight, bottomLeft] = corners;

  return {
    corners: [
      [topLeft[0], topLeft[1]],
      [topRight[0], topRight[1]],
      [bottomRight[0], bottomRight[1]],
      [bottomLeft[0], bottomLeft[1]],
    ],
  };
};

const toPixels = (corners: Quad, size: Size): Quad => [
  [corners[0][0] * size.width, corners[0][1] * size.height],
  [corners[1][0] * size.width, corners[1][1] * size.height],
  [corners[2][0] * size.width, corners[2][1] * size.height],
  [corners[3][0] * size.width, corners[3][1] * size.height],
];

const getDistance = (a: Point, b: Point) =>
  Math.hypot(b[0] - a[0], b[1] - a[1]);

// BE 규칙: 펼친 결과의 가로는 윗변·아랫변 길이의 평균, 세로는 왼변·오른변 길이의 평균이다. 길이는 픽셀로 잰다.
export const getPerspectiveOutputSize = (corners: Quad, size: Size): Size => {
  const [topLeft, topRight, bottomRight, bottomLeft] = toPixels(corners, size);
  const width =
    (getDistance(topLeft, topRight) + getDistance(bottomLeft, bottomRight)) / 2;
  const height =
    (getDistance(topLeft, bottomLeft) + getDistance(topRight, bottomRight)) / 2;

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
};

const MIN_SIDE_RATIO = 0.1;

const getCross = (origin: Point, a: Point, b: Point) =>
  (a[0] - origin[0]) * (b[1] - origin[1]) -
  (a[1] - origin[1]) * (b[0] - origin[0]);

const isInUnitRange = (point: Point) =>
  point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1);

// 꼬이거나 오목한 사각형은 펼친 결과가 뒤집히거나 찢어지므로 볼록한 사각형만 받는다.
export const isValidQuad = (corners: Quad, size: Size) => {
  if (!corners.every(isInUnitRange)) {
    return false;
  }

  const pixels = toPixels(corners, size);
  const crosses = pixels.map((point, index) =>
    getCross(point, pixels[(index + 1) % 4], pixels[(index + 2) % 4]),
  );

  if (!crosses.every((cross) => cross > 0)) {
    return false;
  }

  const minSide = Math.min(size.width, size.height) * MIN_SIDE_RATIO;

  return pixels.every(
    (point, index) => getDistance(point, pixels[(index + 1) % 4]) >= minSide,
  );
};

const solveLinearSystem = (matrix: number[][], vector: number[]) => {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;

    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])
      ) {
        pivot = row;
      }
    }

    if (Math.abs(augmented[pivot][column]) < 1e-12) {
      return null;
    }

    [augmented[column], augmented[pivot]] = [
      augmented[pivot],
      augmented[column],
    ];

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column] / augmented[column][column];

      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }

  return augmented.map((row, index) => row[size] / row[index]);
};

// 네 점 from을 네 점 to로 옮기는 원근 변환 행렬(행 우선 3×3)을 구한다. 풀 수 없으면 null이다.
export const getPerspectiveTransform = (
  from: Quad,
  to: Quad,
): Matrix3 | null => {
  const matrix: number[][] = [];
  const vector: number[] = [];

  from.forEach(([x, y], index) => {
    const [u, v] = to[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    vector.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    vector.push(v);
  });

  const solution = solveLinearSystem(matrix, vector);

  if (solution === null) {
    return null;
  }

  const [a, b, c, d, e, f, g, h] = solution;

  return [a, b, c, d, e, f, g, h, 1];
};

export const applyTransform = (transform: Matrix3, point: Point): Point => {
  const [a, b, c, d, e, f, g, h, i] = transform;
  const [x, y] = point;
  const w = g * x + h * y + i;

  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
};
