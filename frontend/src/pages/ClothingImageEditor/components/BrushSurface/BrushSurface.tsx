import type { PointerEvent, ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/common/Icon';
import { getBrushRadius } from '@/domains/clothingImageEdit/brush';
import { getQuarterTurnedSize } from '@/domains/clothingImageEdit/rotation';
import type { Point, Size } from '@/domains/clothingImageEdit/types';
import * as S from './BrushSurface.styled';
import {
  DEFAULT_BRUSH_VIEW,
  getPinchView,
  getWheelPixels,
  getWheelZoomFactor,
  panBy,
  toMaskPoint,
  zoomAt,
} from './brushView';
import type { BrushGeometry, BrushView } from './brushView';

export interface BrushStrokeStart {
  // 마스크 px 좌표다.
  point: Point;
  // 마스크 px 반지름이다.
  radius: number;
}

interface BrushSurfaceProps {
  children: ReactNode;
  // 그림이 그려지는 요소(미리보기 캔버스)다. 이 요소의 화면 위치로 포인터를 마스크 좌표로 바꾼다.
  targetRef: RefObject<HTMLElement | null>;
  maskSize: Size;
  quarterTurns: number;
  // 화면 px 지름이다.
  brushSize: number;
  view: BrushView;
  onViewChange: (view: BrushView) => void;
  isActive?: boolean;
  isDisabled?: boolean;
  isSizePreviewVisible?: boolean;
  onStrokeStart?: (start: BrushStrokeStart) => void;
  onStrokePoints?: (points: Point[]) => void;
  onStrokeEnd?: () => void;
}

interface Measurement {
  surfaceRect: DOMRect;
  appliedView: BrushView;
  geometry: BrushGeometry;
}

type Interaction =
  | { type: 'idle' }
  | {
      type: 'pending';
      pointerId: number;
      start: BrushStrokeStart;
      points: Point[];
      measurement: Measurement;
      timer: number;
    }
  | { type: 'drawing'; pointerId: number; measurement: Measurement }
  | {
      type: 'gesture';
      pointerIds: readonly [number, number];
      startView: BrushView;
      startPoints: readonly [Point, Point];
      geometry: BrushGeometry;
    }
  // 두 손가락 조작을 마친 뒤 남은 손가락이 그리지 않도록, 모든 손가락이 떨어질 때까지 기다린다.
  | { type: 'waiting' };

/*
 * 두 손가락을 동시에 대도 한 손가락이 먼저 닿는다. 첫 손가락의 획을 잠깐 보류해,
 * 그 사이 두 번째 손가락이 오면 획을 버리고 확대·이동으로 넘어간다.
 */
const TOUCH_HOLD_MS = 100;

const IDLE: Interaction = { type: 'idle' };

const getEventPoints = (event: globalThis.PointerEvent) => {
  const coalesced =
    typeof event.getCoalescedEvents === 'function'
      ? event.getCoalescedEvents()
      : [];

  return coalesced.length > 0 ? coalesced : [event];
};

const BrushSurface = (props: BrushSurfaceProps) => {
  const {
    children,
    targetRef,
    maskSize,
    quarterTurns,
    brushSize,
    view,
    onViewChange,
    isActive = true,
    isDisabled = false,
    isSizePreviewVisible = false,
    onStrokeStart,
    onStrokePoints,
    onStrokeEnd,
  } = props;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const interactionRef = useRef<Interaction>(IDLE);
  const viewRef = useRef(view);
  const latestRef = useRef({
    isActive,
    isInteractive: isActive && !isDisabled,
    onViewChange,
    onStrokeStart,
    onStrokePoints,
    onStrokeEnd,
  });
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);

  const isInteractive = isActive && !isDisabled;

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    latestRef.current = {
      isActive,
      isInteractive,
      onViewChange,
      onStrokeStart,
      onStrokePoints,
      onStrokeEnd,
    };
  }, [
    isActive,
    isInteractive,
    onViewChange,
    onStrokeStart,
    onStrokePoints,
    onStrokeEnd,
  ]);

  // 보류 중인 획은 버리고, 그리던 획은 그린 데까지 확정한다.
  const stopInteraction = () => {
    const interaction = interactionRef.current;
    interactionRef.current = IDLE;
    pointersRef.current.clear();

    if (interaction.type === 'pending') {
      window.clearTimeout(interaction.timer);
    } else if (interaction.type === 'drawing') {
      latestRef.current.onStrokeEnd?.();
    }
  };

  const stopInteractionRef = useRef(stopInteraction);

  useEffect(() => {
    stopInteractionRef.current = stopInteraction;
  });

  useEffect(() => {
    if (!isInteractive) {
      stopInteractionRef.current();
    }
  }, [isInteractive]);

  useEffect(() => {
    return () => {
      stopInteractionRef.current();
    };
  }, []);

  /*
   * 그림 층에 지금 걸린 확대·이동과 1배일 때의 그림 자리를 화면에서 잰다.
   * 그림 층은 표면과 같은 상자라, 두 상자의 비율이 확대율이고 위치 차이가 이동이다.
   */
  const measure = (): Measurement | null => {
    const surface = surfaceRef.current;
    const layer = layerRef.current;
    const target = targetRef.current;

    if (surface === null || layer === null || target === null) {
      return null;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    if (surfaceRect.width <= 0 || layerRect.width <= 0) {
      return null;
    }

    const zoom = layerRect.width / surfaceRect.width;
    const width = targetRect.width / zoom;
    const height = targetRect.height / zoom;
    const turned = getQuarterTurnedSize(maskSize, quarterTurns);

    if (width <= 0 || height <= 0 || turned.width <= 0) {
      return null;
    }

    const left = (targetRect.left - layerRect.left) / zoom;
    const top = (targetRect.top - layerRect.top) / zoom;

    return {
      surfaceRect,
      appliedView: {
        zoom,
        x: layerRect.left - surfaceRect.left,
        y: layerRect.top - surfaceRect.top,
      },
      geometry: {
        center: [left + width / 2, top + height / 2],
        displayScale: width / turned.width,
        quarterTurns,
        maskSize,
      },
    };
  };

  const emitView = (nextView: BrushView) => {
    const current = viewRef.current;

    if (
      current.zoom === nextView.zoom &&
      current.x === nextView.x &&
      current.y === nextView.y
    ) {
      return;
    }

    viewRef.current = nextView;
    latestRef.current.onViewChange(nextView);
  };

  const toMaskPoints = (
    events: readonly globalThis.PointerEvent[],
    measurement: Measurement,
  ) =>
    events.map((pointerEvent): Point =>
      toMaskPoint(
        [
          pointerEvent.clientX - measurement.surfaceRect.left,
          pointerEvent.clientY - measurement.surfaceRect.top,
        ],
        measurement.appliedView,
        measurement.geometry,
      ),
    );

  const beginDrawing = (
    pointerId: number,
    start: BrushStrokeStart,
    points: Point[],
    measurement: Measurement,
  ) => {
    interactionRef.current = { type: 'drawing', pointerId, measurement };
    latestRef.current.onStrokeStart?.(start);

    if (points.length > 0) {
      latestRef.current.onStrokePoints?.(points);
    }
  };

  const beginGesture = () => {
    const entries = [...pointersRef.current.entries()];
    const first = entries.at(0);
    const second = entries.at(1);
    const measurement = measure();

    if (first === undefined || second === undefined || measurement === null) {
      interactionRef.current = { type: 'waiting' };
      return;
    }

    viewRef.current = measurement.appliedView;
    interactionRef.current = {
      type: 'gesture',
      pointerIds: [first[0], second[0]],
      startView: measurement.appliedView,
      startPoints: [first[1], second[1]],
      geometry: measurement.geometry,
    };
  };

  const getLocalPoint = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();

    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isInteractive || event.button !== 0) {
      return;
    }

    const { pointerId } = event;
    pointersRef.current.set(pointerId, getLocalPoint(event));

    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      // 합성 이벤트처럼 활성 포인터가 아니면 붙잡지 못하지만, 표면 안의 움직임은 그대로 따라간다.
    }

    const interaction = interactionRef.current;
    const pointerCount = pointersRef.current.size;

    if (pointerCount === 2) {
      if (interaction.type === 'pending') {
        window.clearTimeout(interaction.timer);
      } else if (interaction.type === 'drawing') {
        latestRef.current.onStrokeEnd?.();
      }

      beginGesture();
      return;
    }

    if (pointerCount !== 1 || interaction.type !== 'idle') {
      return;
    }

    const measurement = measure();

    if (measurement === null) {
      interactionRef.current = { type: 'waiting' };
      return;
    }

    const [point] = toMaskPoints([event.nativeEvent], measurement);

    if (point === undefined) {
      return;
    }

    const start = {
      point,
      radius: getBrushRadius(
        brushSize,
        measurement.geometry.displayScale,
        measurement.appliedView.zoom,
      ),
    };

    if (event.pointerType !== 'touch') {
      beginDrawing(pointerId, start, [], measurement);
      return;
    }

    const timer = window.setTimeout(() => {
      const pending = interactionRef.current;

      if (pending.type === 'pending' && pending.pointerId === pointerId) {
        beginDrawing(
          pointerId,
          pending.start,
          pending.points,
          pending.measurement,
        );
      }
    }, TOUCH_HOLD_MS);

    interactionRef.current = {
      type: 'pending',
      pointerId,
      start,
      points: [],
      measurement,
      timer,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const { pointerId } = event;

    if (isInteractive && event.pointerType === 'mouse') {
      setCursorPoint(getLocalPoint(event));
    }

    // 캡처를 잃어 pointerup을 못 받은 채 버튼이 이미 떼어졌으면, 그리기를 여기서 끝낸다.
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      endPointer(pointerId, false);
    }

    if (!pointersRef.current.has(pointerId)) {
      return;
    }

    pointersRef.current.set(pointerId, getLocalPoint(event));
    const interaction = interactionRef.current;

    switch (interaction.type) {
      case 'pending':
        if (interaction.pointerId === pointerId) {
          interaction.points.push(
            ...toMaskPoints(
              getEventPoints(event.nativeEvent),
              interaction.measurement,
            ),
          );
        }
        break;
      case 'drawing':
        if (interaction.pointerId === pointerId) {
          latestRef.current.onStrokePoints?.(
            toMaskPoints(
              getEventPoints(event.nativeEvent),
              interaction.measurement,
            ),
          );
        }
        break;
      case 'gesture': {
        const [firstId, secondId] = interaction.pointerIds;
        const first = pointersRef.current.get(firstId);
        const second = pointersRef.current.get(secondId);

        if (first !== undefined && second !== undefined) {
          emitView(
            getPinchView(
              interaction.startView,
              interaction.startPoints,
              [first, second],
              interaction.geometry,
            ),
          );
        }
        break;
      }
      default:
        break;
    }
  };

  const endPointer = (pointerId: number, isCancelled: boolean) => {
    if (!pointersRef.current.delete(pointerId)) {
      return;
    }

    const interaction = interactionRef.current;

    if (interaction.type === 'pending' && interaction.pointerId === pointerId) {
      window.clearTimeout(interaction.timer);

      // 짧게 톡 친 것도 점 하나로 칠한다. 브라우저가 가져간 터치는 버린다.
      if (!isCancelled) {
        beginDrawing(
          pointerId,
          interaction.start,
          interaction.points,
          interaction.measurement,
        );
        latestRef.current.onStrokeEnd?.();
      }

      interactionRef.current = { type: 'waiting' };
    } else if (
      interaction.type === 'drawing' &&
      interaction.pointerId === pointerId
    ) {
      latestRef.current.onStrokeEnd?.();
      interactionRef.current = { type: 'waiting' };
    } else if (
      interaction.type === 'gesture' &&
      interaction.pointerIds.includes(pointerId)
    ) {
      interactionRef.current = { type: 'waiting' };
    }

    if (pointersRef.current.size === 0) {
      interactionRef.current = IDLE;
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    endPointer(event.pointerId, false);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    endPointer(event.pointerId, true);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      setCursorPoint(null);
    }
  };

  const measureRef = useRef(measure);
  const emitViewRef = useRef(emitView);

  useEffect(() => {
    measureRef.current = measure;
    emitViewRef.current = emitView;
  });

  useEffect(() => {
    const surface = surfaceRef.current;

    if (surface === null) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      const latest = latestRef.current;

      if (!latest.isActive) {
        return;
      }

      event.preventDefault();

      if (!latest.isInteractive || interactionRef.current.type !== 'idle') {
        return;
      }

      const measurement = measureRef.current();

      if (measurement === null) {
        return;
      }

      const { surfaceRect, geometry } = measurement;
      const current = viewRef.current;

      if (event.ctrlKey) {
        const deltaY = getWheelPixels(
          event.deltaY,
          event.deltaMode,
          surfaceRect.height,
        );
        emitViewRef.current(
          zoomAt(
            current,
            current.zoom * getWheelZoomFactor(deltaY),
            [event.clientX - surfaceRect.left, event.clientY - surfaceRect.top],
            geometry,
          ),
        );
        return;
      }

      emitViewRef.current(
        panBy(
          current,
          -getWheelPixels(event.deltaX, event.deltaMode, surfaceRect.width),
          -getWheelPixels(event.deltaY, event.deltaMode, surfaceRect.height),
          geometry,
        ),
      );
    };

    // iOS Safari는 touch-action과 별개로 핀치에 페이지 확대 제스처를 보낸다.
    const handleGesture = (event: Event) => {
      if (latestRef.current.isActive) {
        event.preventDefault();
      }
    };

    surface.addEventListener('wheel', handleWheel, { passive: false });
    surface.addEventListener('gesturestart', handleGesture);
    surface.addEventListener('gesturechange', handleGesture);

    return () => {
      surface.removeEventListener('wheel', handleWheel);
      surface.removeEventListener('gesturestart', handleGesture);
      surface.removeEventListener('gesturechange', handleGesture);
    };
  }, []);

  const isTransformed =
    isActive && (view.zoom !== 1 || view.x !== 0 || view.y !== 0);
  const zoomPercent = Math.round(view.zoom * 100);

  return (
    <S.Surface
      ref={surfaceRef}
      role={isActive ? 'group' : undefined}
      aria-label={isActive ? '브러시 그리기 영역' : undefined}
      $isActive={isActive}
      $isInteractive={isInteractive}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={(event) => endPointer(event.pointerId, false)}
      onPointerLeave={handlePointerLeave}
    >
      <S.Layer
        ref={layerRef}
        style={
          isTransformed
            ? {
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
              }
            : undefined
        }
      >
        {children}
      </S.Layer>
      {isInteractive && cursorPoint !== null && (
        <S.CursorRing
          aria-hidden
          style={{
            width: brushSize,
            height: brushSize,
            transform: `translate(${cursorPoint[0] - brushSize / 2}px, ${cursorPoint[1] - brushSize / 2}px)`,
          }}
        />
      )}
      {isActive && isSizePreviewVisible && (
        <S.SizePreview
          aria-hidden
          style={{ width: brushSize, height: brushSize }}
        />
      )}
      {isActive && (
        <S.ZoomChip
          type="button"
          aria-label={`화면에 맞추기, 지금 ${zoomPercent}%`}
          disabled={isDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => emitView(DEFAULT_BRUSH_VIEW)}
        >
          <S.ChipIcon>
            <Icon name="fit_screen" size="xs" />
          </S.ChipIcon>
          {zoomPercent}%
        </S.ZoomChip>
      )}
    </S.Surface>
  );
};

export default BrushSurface;
