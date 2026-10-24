import { normalizeQuarterTurns } from './angle';
import type { Point, Size } from './types';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// 부동소수점 오차로 90° 회전이 1px 커지지 않을 만큼만 빼고 올린다.
const ceilSize = (value: number) => Math.max(1, Math.ceil(value - 1e-6));

export const getRotatedBounds = (size: Size, angle: number): Size => {
  const radians = toRadians(Number.isFinite(angle) ? angle : 0);
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: ceilSize(size.width * cos + size.height * sin),
    height: ceilSize(size.width * sin + size.height * cos),
  };
};

export const getQuarterTurnedSize = (size: Size, quarterTurns: number): Size =>
  normalizeQuarterTurns(quarterTurns) % 2 === 0
    ? size
    : { width: size.height, height: size.width };

// 원본 기준 0~1 좌표를 시계 방향으로 90°씩 돌린 화면의 0~1 좌표로 바꾼다.
export const toViewPoint = (point: Point, quarterTurns: number): Point => {
  const [x, y] = point;

  switch (normalizeQuarterTurns(quarterTurns)) {
    case 1:
      return [1 - y, x];
    case 2:
      return [1 - x, 1 - y];
    case 3:
      return [y, 1 - x];
    default:
      return [x, y];
  }
};

export const toSourcePoint = (point: Point, quarterTurns: number): Point =>
  toViewPoint(point, -quarterTurns);
