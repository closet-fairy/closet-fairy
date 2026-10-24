import { isValidQuad } from '@/domains/clothingImageEdit/perspective';
import {
  getQuarterTurnedSize,
  toSourcePoint,
  toViewPoint,
} from '@/domains/clothingImageEdit/rotation';
import type { Point, Quad, Size } from '@/domains/clothingImageEdit/types';

export const GRAB_RADIUS = 22;

export type CornerIndex = 0 | 1 | 2 | 3;

const CORNER_INDICES = [0, 1, 2, 3] as const;

export interface GrabbedCorner {
  index: CornerIndex;
  offset: Point;
}

interface MoveCornerParams {
  corners: Quad;
  quarterTurns: number;
  index: CornerIndex;
  pointer: Point;
  offset: Point;
  boxSize: Size;
  // 누끼 크기다. 없으면 화면 상자 크기를 거꾸로 돌려 대신 쓴다.
  imageSize?: Size;
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const replaceCorner = (
  corners: Quad,
  index: CornerIndex,
  point: Point,
): Quad => [
  index === 0 ? point : corners[0],
  index === 1 ? point : corners[1],
  index === 2 ? point : corners[2],
  index === 3 ? point : corners[3],
];

export const getViewCorners = (corners: Quad, quarterTurns: number): Quad => [
  toViewPoint(corners[0], quarterTurns),
  toViewPoint(corners[1], quarterTurns),
  toViewPoint(corners[2], quarterTurns),
  toViewPoint(corners[3], quarterTurns),
];

export const pickCorner = (
  viewCorners: Quad,
  pointer: Point,
  boxSize: Size,
): GrabbedCorner | null => {
  let picked: GrabbedCorner | null = null;
  let pickedDistance = GRAB_RADIUS;

  for (const index of CORNER_INDICES) {
    const [x, y] = viewCorners[index];
    const offset: Point = [x - pointer[0], y - pointer[1]];
    const distance = Math.hypot(
      offset[0] * boxSize.width,
      offset[1] * boxSize.height,
    );

    if (distance <= pickedDistance) {
      picked = { index, offset };
      pickedDistance = distance;
    }
  }

  return picked;
};

/*
 * 화면 상자는 90° 방향만 돌린 그림을 같은 배율로 담는다. 그래서 상자 크기를 거꾸로 돌린 값도 판정이 거의 같다.
 * 다만 화면 크기는 반올림돼 다시 열 때의 판정과 어긋날 수 있어, 누끼 크기가 있으면 그것을 쓴다.
 */
export const moveCorner = (params: MoveCornerParams): Quad | null => {
  const { corners, quarterTurns, index, pointer, offset, boxSize, imageSize } =
    params;

  const viewPoint: Point = [
    clampUnit(pointer[0] + offset[0]),
    clampUnit(pointer[1] + offset[1]),
  ];
  const nextCorners = replaceCorner(
    corners,
    index,
    toSourcePoint(viewPoint, quarterTurns),
  );

  return isValidQuad(
    nextCorners,
    imageSize ?? getQuarterTurnedSize(boxSize, quarterTurns),
  )
    ? nextCorners
    : null;
};
