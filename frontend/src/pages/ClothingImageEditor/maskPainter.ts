import {
  advanceStamps,
  getStampSpacing,
  getStampsBounds,
} from '@/domains/clothingImageEdit/brush';
import type {
  BrushMode,
  BrushStroke,
  Rect,
  StampCursor,
} from '@/domains/clothingImageEdit/brush';
import type { Point, Size } from '@/domains/clothingImageEdit/types';

export type MaskContext = Pick<
  CanvasRenderingContext2D,
  'drawImage' | 'save' | 'restore' | 'globalCompositeOperation'
>;

export type CreateBrushStamp = (
  mode: BrushMode,
  radius: number,
) => HTMLCanvasElement;

const STAMP_COLOR: Record<BrushMode, string> = {
  erase: '0, 0, 0',
  restore: '255, 255, 255',
};

// 붓 가장자리를 살짝만 부드럽게 하는 고정값이다. 반지름의 이 비율까지는 완전히 칠한다.
const SOLID_RATIO = 0.75;
// 도장을 소수점 자리에 그리면 보간으로 한 픽셀 번질 수 있어 여유를 둔다.
const STAMP_MARGIN = 1;

const getStampSize = (radius: number) =>
  Math.ceil(radius * 2) + STAMP_MARGIN * 2;

/*
 * 마스크는 알파가 늘 255인 흑백이어야 한다(BE와 MSW가 반투명 픽셀을 다르게 다룬다).
 * 알파가 1인 바탕 위에 source-over로 칠하면 결과 알파는 a + 1 × (1 - a) = 1이라,
 * 붓 가장자리의 반투명은 색을 섞을 뿐 알파를 바꾸지 않는다.
 */
export const createBrushStamp: CreateBrushStamp = (mode, radius) => {
  const size = getStampSize(radius);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context === null) {
    return canvas;
  }

  const center = size / 2;
  const color = STAMP_COLOR[mode];
  const gradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    radius,
  );
  gradient.addColorStop(0, `rgba(${color}, 1)`);
  gradient.addColorStop(SOLID_RATIO, `rgba(${color}, 1)`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  return canvas;
};

export interface StrokePainter {
  // 이어지는 점들을 칠하고, 칠한 영역(마스크 밖은 잘라 냄)을 돌려준다.
  paint: (points: readonly Point[]) => Rect | null;
}

export const createStrokePainter = (
  context: MaskContext,
  stroke: Pick<BrushStroke, 'mode' | 'radius'>,
  maskSize: Size,
  createStamp: CreateBrushStamp = createBrushStamp,
): StrokePainter => {
  const stamp = createStamp(stroke.mode, stroke.radius);
  const half = getStampSize(stroke.radius) / 2;
  const spacing = getStampSpacing(stroke.radius);
  let cursor: StampCursor | null = null;

  return {
    paint: (points) => {
      const stamps: Point[] = [];

      for (const point of points) {
        const advanced = advanceStamps(cursor, point, spacing);
        stamps.push(...advanced.stamps);
        cursor = advanced.cursor;
      }

      if (stamps.length === 0) {
        return null;
      }

      context.save();
      context.globalCompositeOperation = 'source-over';

      for (const [x, y] of stamps) {
        context.drawImage(stamp, x - half, y - half);
      }

      context.restore();

      return getStampsBounds(stamps, half, maskSize);
    },
  };
};

export const paintStroke = (
  context: MaskContext,
  stroke: BrushStroke,
  maskSize: Size,
  createStamp?: CreateBrushStamp,
) =>
  createStrokePainter(context, stroke, maskSize, createStamp).paint(
    stroke.points,
  );

// 기준 마스크를 편집용 마스크에 그대로 덮어쓴다.
export const copyMask = (context: MaskContext, source: CanvasImageSource) => {
  context.save();
  context.globalCompositeOperation = 'copy';
  context.drawImage(source, 0, 0);
  context.restore();
};
