import {
  getQuarterTurnedSize,
  toSourcePoint,
} from '@/domains/clothingImageEdit/rotation';
import type { Point, Size } from '@/domains/clothingImageEdit/types';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/*
 * 그림 층에 `translate(x, y) scale(zoom)`(원점은 표면 왼쪽 위)으로 적용하는 확대·이동이다.
 * x, y는 표면 px다.
 */
export interface BrushView {
  zoom: number;
  x: number;
  y: number;
}

export const DEFAULT_BRUSH_VIEW: BrushView = { zoom: 1, x: 0, y: 0 };

/*
 * 1배일 때 그림이 놓인 자리와 크기다. 표면 px 기준이다.
 * center는 그림 가운데, displayScale은 마스크 1px이 화면 몇 px인지다.
 */
export interface BrushGeometry {
  center: Point;
  displayScale: number;
  quarterTurns: number;
  maskSize: Size;
}

const WHEEL_LINE_HEIGHT = 16;
// 마우스 휠 한 칸(약 100)이 한 번에 너무 크게 확대하지 않게 이벤트 하나의 변화량을 자른다.
const MAX_WHEEL_ZOOM_DELTA = 50;
const WHEEL_ZOOM_SPEED = 0.01;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const clampZoom = (zoom: number) =>
  Number.isFinite(zoom) ? clamp(zoom, MIN_ZOOM, MAX_ZOOM) : MIN_ZOOM;

export const getViewSize = (geometry: BrushGeometry): Size => {
  const turned = getQuarterTurnedSize(geometry.maskSize, geometry.quarterTurns);

  return {
    width: turned.width * geometry.displayScale,
    height: turned.height * geometry.displayScale,
  };
};

/*
 * 확대한 만큼만 움직일 수 있게 한다. 그림 가장자리는 1배일 때의 자리까지만 들어오므로
 * 그림이 영역 밖으로 나가지 않고, 1배에서는 가운데에 고정된다.
 */
const clampAxis = (
  offset: number,
  zoom: number,
  center: number,
  length: number,
) => {
  const centered = center * (1 - zoom);
  const travel = ((zoom - 1) * length) / 2;

  return clamp(offset, centered - travel, centered + travel);
};

export const clampView = (
  view: BrushView,
  geometry: BrushGeometry,
): BrushView => {
  const zoom = clampZoom(view.zoom);
  const size = getViewSize(geometry);
  const [centerX, centerY] = geometry.center;

  return {
    zoom,
    x: clampAxis(view.x, zoom, centerX, size.width),
    y: clampAxis(view.y, zoom, centerY, size.height),
  };
};

export const toContentPoint = (point: Point, view: BrushView): Point => [
  (point[0] - view.x) / view.zoom,
  (point[1] - view.y) / view.zoom,
];

// 표면 px 점을 원래 방향 마스크 px 점으로 바꾼다. 그림 밖이면 마스크 밖 좌표가 그대로 나온다.
export const toMaskPoint = (
  point: Point,
  view: BrushView,
  geometry: BrushGeometry,
): Point => {
  const [contentX, contentY] = toContentPoint(point, view);
  const size = getViewSize(geometry);
  const [centerX, centerY] = geometry.center;
  const [sourceX, sourceY] = toSourcePoint(
    [
      (contentX - centerX) / size.width + 0.5,
      (contentY - centerY) / size.height + 0.5,
    ],
    geometry.quarterTurns,
  );

  return [
    sourceX * geometry.maskSize.width,
    sourceY * geometry.maskSize.height,
  ];
};

// 커서 아래의 그림 점이 확대 뒤에도 커서 아래에 남도록 이동을 다시 잡는다.
export const zoomAt = (
  view: BrushView,
  zoom: number,
  anchor: Point,
  geometry: BrushGeometry,
): BrushView => {
  const nextZoom = clampZoom(zoom);
  const [contentX, contentY] = toContentPoint(anchor, view);

  return clampView(
    {
      zoom: nextZoom,
      x: anchor[0] - contentX * nextZoom,
      y: anchor[1] - contentY * nextZoom,
    },
    geometry,
  );
};

export const panBy = (
  view: BrushView,
  deltaX: number,
  deltaY: number,
  geometry: BrushGeometry,
): BrushView =>
  clampView({ ...view, x: view.x + deltaX, y: view.y + deltaY }, geometry);

const getMidpoint = (first: Point, second: Point): Point => [
  (first[0] + second[0]) / 2,
  (first[1] + second[1]) / 2,
];

const getDistance = (first: Point, second: Point) =>
  Math.hypot(second[0] - first[0], second[1] - first[1]);

/*
 * 두 손가락이 처음 닿았을 때를 기준으로 매번 다시 계산한다.
 * 처음 가운데 점 아래에 있던 그림 점이 지금 가운데 점을 따라가고, 손가락 사이 거리 비율만큼 확대한다.
 */
export const getPinchView = (
  startView: BrushView,
  startPoints: readonly [Point, Point],
  points: readonly [Point, Point],
  geometry: BrushGeometry,
): BrushView => {
  const startDistance = getDistance(...startPoints);
  const distance = getDistance(...points);
  const ratio = startDistance > 0 ? distance / startDistance : 1;
  const nextZoom = clampZoom(startView.zoom * ratio);
  const [contentX, contentY] = toContentPoint(
    getMidpoint(...startPoints),
    startView,
  );
  const [midX, midY] = getMidpoint(...points);

  return clampView(
    {
      zoom: nextZoom,
      x: midX - contentX * nextZoom,
      y: midY - contentY * nextZoom,
    },
    geometry,
  );
};

export const getWheelPixels = (
  delta: number,
  deltaMode: number,
  pageSize: number,
) => {
  switch (deltaMode) {
    case 1:
      return delta * WHEEL_LINE_HEIGHT;
    case 2:
      return delta * pageSize;
    default:
      return delta;
  }
};

export const getWheelZoomFactor = (deltaY: number) =>
  Math.exp(
    -clamp(deltaY, -MAX_WHEEL_ZOOM_DELTA, MAX_WHEEL_ZOOM_DELTA) *
      WHEEL_ZOOM_SPEED,
  );
