import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Point, Quad, Size } from '@/domains/clothingImageEdit/types';
import { spacing } from '@/styles/tokens';
import {
  getMagnifierCrop,
  getMagnifierRadius,
  MAGNIFIER_SIZE,
} from './magnifier';
import { getViewCorners, moveCorner, pickCorner } from './moveCorner';
import type { CornerIndex } from './moveCorner';
import * as S from './PerspectiveOverlay.styled';

interface PerspectiveOverlayProps {
  corners: Quad;
  quarterTurns: number;
  onChange: (corners: Quad) => void;
  imageSize?: Size;
  onDraggingChange?: (isDragging: boolean) => void;
  magnifierSource: HTMLCanvasElement | null;
  magnifierContainer?: HTMLElement | null;
  magnifierTop?: number;
  isDisabled?: boolean;
}

interface Drag {
  pointerId: number;
  index: CornerIndex;
  offset: Point;
}

interface ActiveCorner {
  index: CornerIndex;
  boxSize: Size;
}

interface MeasuredPointer {
  pointer: Point;
  boxSize: Size;
}

// 단위가 상자 크기(0~1)이므로, 스테이지 전체를 덮을 만큼 넉넉한 바깥 사각형이다.
const DIM_OUTER_PATH = 'M-100 -100H101V101H-100Z';

const toPolygonPoints = (quad: Quad) =>
  quad.map(([x, y]) => `${x},${y}`).join(' ');

const toQuadPath = (quad: Quad) => `M${toPolygonPoints(quad)}Z`;

const PerspectiveOverlay = (props: PerspectiveOverlayProps) => {
  const {
    corners,
    quarterTurns,
    onChange,
    imageSize,
    onDraggingChange,
    magnifierSource,
    magnifierContainer,
    magnifierTop,
    isDisabled = false,
  } = props;

  const boxRef = useRef<HTMLDivElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  const [activeCorner, setActiveCorner] = useState<ActiveCorner | null>(null);

  const viewCorners = getViewCorners(corners, quarterTurns);
  const activePoint =
    activeCorner === null ? null : viewCorners[activeCorner.index];
  const activeX = activePoint?.[0];
  const activeY = activePoint?.[1];

  useEffect(() => {
    return () => {
      endDragRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (isDisabled) {
      endDragRef.current?.();
    }
  }, [isDisabled]);

  useEffect(() => {
    const canvas = magnifierCanvasRef.current;
    const context = canvas?.getContext('2d');

    if (
      !canvas ||
      !context ||
      activeCorner === null ||
      activeX === undefined ||
      activeY === undefined
    ) {
      return;
    }

    const destinationSize = Math.round(
      MAGNIFIER_SIZE * window.devicePixelRatio,
    );

    if (canvas.width !== destinationSize) {
      canvas.width = destinationSize;
      canvas.height = destinationSize;
    }

    context.clearRect(0, 0, destinationSize, destinationSize);

    if (magnifierSource === null) {
      return;
    }

    const crop = getMagnifierCrop({
      center: [activeX, activeY],
      boxSize: activeCorner.boxSize,
      sourceSize: {
        width: magnifierSource.width,
        height: magnifierSource.height,
      },
      destinationSize,
    });

    if (crop !== null) {
      context.drawImage(
        magnifierSource,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        crop.dx,
        crop.dy,
        crop.dw,
        crop.dh,
      );
    }
  }, [activeCorner, activeX, activeY, magnifierSource]);

  const measurePointer = (
    event: PointerEvent<HTMLDivElement>,
  ): MeasuredPointer | null => {
    const box = boxRef.current?.getBoundingClientRect();

    if (!box || box.width <= 0 || box.height <= 0) {
      return null;
    }

    return {
      pointer: [
        (event.clientX - box.left) / box.width,
        (event.clientY - box.top) / box.height,
      ],
      boxSize: { width: box.width, height: box.height },
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isDisabled || event.button !== 0 || dragRef.current !== null) {
      return;
    }

    const measured = measurePointer(event);
    const grabbed =
      measured && pickCorner(viewCorners, measured.pointer, measured.boxSize);

    if (!measured || !grabbed) {
      return;
    }

    event.preventDefault();
    const { pointerId } = event;

    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      // 합성 이벤트처럼 활성 포인터가 아니면 붙잡지 못하지만, 상자 안의 움직임은 그대로 따라간다.
    }

    dragRef.current = {
      pointerId,
      index: grabbed.index,
      offset: grabbed.offset,
    };
    setActiveCorner({ index: grabbed.index, boxSize: measured.boxSize });
    onDraggingChange?.(true);

    endDragRef.current = () => {
      dragRef.current = null;
      endDragRef.current = null;
      setActiveCorner(null);
      onDraggingChange?.(false);
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (drag === null || event.pointerId !== drag.pointerId) {
      return;
    }

    if (event.buttons === 0) {
      endDragRef.current?.();
      return;
    }

    const measured = measurePointer(event);

    if (measured === null) {
      return;
    }

    const nextCorners = moveCorner({
      corners,
      quarterTurns,
      index: drag.index,
      pointer: measured.pointer,
      offset: drag.offset,
      boxSize: measured.boxSize,
      imageSize,
    });

    if (nextCorners !== null) {
      onChange(nextCorners);
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      endDragRef.current?.();
    }
  };

  const renderShapes = () => (
    <>
      <S.Dim d={`${DIM_OUTER_PATH}${toQuadPath(viewCorners)}`} />
      <S.EdgeShadow
        points={toPolygonPoints(viewCorners)}
        vectorEffect="non-scaling-stroke"
      />
      <S.Edge
        points={toPolygonPoints(viewCorners)}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );

  const renderMagnifier = () => {
    if (
      activeCorner === null ||
      activeX === undefined ||
      activeY === undefined
    ) {
      return null;
    }

    const [radiusX, radiusY] = getMagnifierRadius(activeCorner.boxSize);
    const magnifier = (
      <S.Magnifier
        $side={activeX < 0.5 ? 'right' : 'left'}
        style={{ top: magnifierTop ?? spacing[12] }}
        aria-hidden
      >
        <S.MagnifierCanvas ref={magnifierCanvasRef} />
        <S.MagnifierShapes
          viewBox={`${activeX - radiusX} ${activeY - radiusY} ${radiusX * 2} ${radiusY * 2}`}
          preserveAspectRatio="none"
        >
          {renderShapes()}
        </S.MagnifierShapes>
        <S.CrosshairHorizontal />
        <S.CrosshairVertical />
      </S.Magnifier>
    );

    return magnifierContainer
      ? createPortal(magnifier, magnifierContainer)
      : magnifier;
  };

  return (
    <S.Root
      role="group"
      aria-label="원근 꼭짓점"
      aria-disabled={isDisabled}
      $isDisabled={isDisabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      <S.Box ref={boxRef}>
        <S.Shapes viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
          {renderShapes()}
        </S.Shapes>
        {viewCorners.map(([x, y], index) => (
          <S.Handle
            key={index}
            $isDisabled={isDisabled}
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          />
        ))}
        {renderMagnifier()}
      </S.Box>
    </S.Root>
  );
};

export default PerspectiveOverlay;
