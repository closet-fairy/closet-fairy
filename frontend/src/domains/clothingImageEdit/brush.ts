import type { Point, Size } from './types';

export type BrushMode = 'erase' | 'restore';

// 붓 크기는 화면 px 지름이다. 확대해도 손가락으로 느끼는 크기가 같아야 하기 때문이다.
export const BRUSH_SIZE_MIN = 4;
export const BRUSH_SIZE_MAX = 80;
export const BRUSH_SIZE_DEFAULT = 20;

const STAMP_SPACING_RATIO = 0.25;
// 아주 작은 붓에서 도장 수가 지나치게 늘지 않게 하는 하한이다.
const MIN_STAMP_SPACING = 0.5;

export interface BrushStroke {
  mode: BrushMode;
  // 마스크 px 반지름이다.
  radius: number;
  // 마스크 px 좌표다.
  points: readonly Point[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StampCursor {
  point: Point;
  // 마지막 도장 뒤로 지나온 거리다.
  carry: number;
}

export const getBrushRadius = (
  brushSize: number,
  displayScale: number,
  zoom: number,
) => brushSize / 2 / (displayScale * zoom);

export const getStampSpacing = (radius: number) =>
  Math.max(radius * STAMP_SPACING_RATIO, MIN_STAMP_SPACING);

/*
 * 포인터 이벤트 사이의 빈틈을 같은 간격의 도장으로 메운다.
 * 획을 이어 그릴 때와 실행 취소 뒤 다시 그릴 때 도장 자리가 같아야 해서, 남은 거리를 커서에 들고 넘긴다.
 */
export const advanceStamps = (
  cursor: StampCursor | null,
  to: Point,
  spacing: number,
): { stamps: Point[]; cursor: StampCursor } => {
  if (cursor === null) {
    return { stamps: [to], cursor: { point: to, carry: 0 } };
  }

  const [fromX, fromY] = cursor.point;
  const deltaX = to[0] - fromX;
  const deltaY = to[1] - fromY;
  const length = Math.hypot(deltaX, deltaY);

  if (length === 0) {
    return { stamps: [], cursor };
  }

  const stamps: Point[] = [];

  for (
    let distance = spacing - cursor.carry;
    distance <= length;
    distance += spacing
  ) {
    const ratio = distance / length;
    stamps.push([fromX + deltaX * ratio, fromY + deltaY * ratio]);
  }

  return {
    stamps,
    cursor: {
      point: to,
      carry: cursor.carry + length - stamps.length * spacing,
    },
  };
};

// 도장들이 칠한 영역을 감싸는 정수 사각형이다. 마스크 밖은 잘라 내고, 겹치는 곳이 없으면 null이다.
export const getStampsBounds = (
  stamps: readonly Point[],
  extent: number,
  maskSize: Size,
): Rect | null => {
  if (stamps.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of stamps) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const left = Math.max(0, Math.floor(minX - extent));
  const top = Math.max(0, Math.floor(minY - extent));
  const right = Math.min(maskSize.width, Math.ceil(maxX + extent));
  const bottom = Math.min(maskSize.height, Math.ceil(maxY + extent));

  if (right <= left || bottom <= top) {
    return null;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const unionRects = (first: Rect | null, second: Rect | null) => {
  if (first === null) {
    return second;
  }

  if (second === null) {
    return first;
  }

  const left = Math.min(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
};
