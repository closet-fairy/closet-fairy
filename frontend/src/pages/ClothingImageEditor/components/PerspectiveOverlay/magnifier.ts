import type { Point, Size } from '@/domains/clothingImageEdit/types';

export const MAGNIFIER_SIZE = 96;
export const MAGNIFIER_ZOOM = 3;

// 돋보기 반지름을 화면 상자 기준 0~1 길이로 나타낸 값이다.
export const getMagnifierRadius = (boxSize: Size): Point => {
  const radius = MAGNIFIER_SIZE / 2 / MAGNIFIER_ZOOM;

  return [radius / boxSize.width, radius / boxSize.height];
};

interface AxisCrop {
  source: number;
  sourceLength: number;
  destination: number;
  destinationLength: number;
}

const getAxisCrop = (
  center: number,
  radius: number,
  sourceLength: number,
  destinationLength: number,
): AxisCrop | null => {
  const start = (center - radius) * sourceLength;
  const end = (center + radius) * sourceLength;
  const clippedStart = Math.max(0, start);
  const clippedEnd = Math.min(sourceLength, end);

  if (clippedEnd <= clippedStart) {
    return null;
  }

  const ratio = destinationLength / (end - start);

  return {
    source: clippedStart,
    sourceLength: clippedEnd - clippedStart,
    destination: (clippedStart - start) * ratio,
    destinationLength: (clippedEnd - clippedStart) * ratio,
  };
};

export interface MagnifierCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

interface MagnifierCropParams {
  center: Point;
  boxSize: Size;
  sourceSize: Size;
  destinationSize: number;
}

/*
 * 꼭짓점이 사진 가장자리에 있으면 돋보기 범위가 사진 밖으로 나간다.
 * 원본 밖까지 걸친 영역을 drawImage에 넘기면 브라우저에 따라 아무것도 그리지 않을 수 있어, 사진 안쪽만 잘라 그 비율대로 그릴 자리를 줄인다.
 */
export const getMagnifierCrop = (
  params: MagnifierCropParams,
): MagnifierCrop | null => {
  const { center, boxSize, sourceSize, destinationSize } = params;

  const [radiusX, radiusY] = getMagnifierRadius(boxSize);
  const cropX = getAxisCrop(
    center[0],
    radiusX,
    sourceSize.width,
    destinationSize,
  );
  const cropY = getAxisCrop(
    center[1],
    radiusY,
    sourceSize.height,
    destinationSize,
  );

  if (cropX === null || cropY === null) {
    return null;
  }

  return {
    sx: cropX.source,
    sy: cropY.source,
    sw: cropX.sourceLength,
    sh: cropY.sourceLength,
    dx: cropX.destination,
    dy: cropY.destination,
    dw: cropX.destinationLength,
    dh: cropY.destinationLength,
  };
};
