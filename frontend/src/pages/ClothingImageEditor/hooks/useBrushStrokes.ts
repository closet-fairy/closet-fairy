import { useCallback, useEffect, useRef, useState } from 'react';
import { unionRects } from '@/domains/clothingImageEdit/brush';
import type {
  BrushMode,
  BrushStroke,
  Rect,
} from '@/domains/clothingImageEdit/brush';
import {
  canRedoStroke,
  canUndoStroke,
  EMPTY_BRUSH_HISTORY,
  pushStroke,
  redoStroke,
  undoStroke,
} from '@/domains/clothingImageEdit/brushHistory';
import type { BrushHistory } from '@/domains/clothingImageEdit/brushHistory';
import type { Point, Size } from '@/domains/clothingImageEdit/types';
import type { BrushStrokeStart } from '@/pages/ClothingImageEditor/components/BrushSurface/BrushSurface';
import {
  copyMask,
  createStrokePainter,
  paintStroke,
} from '@/pages/ClothingImageEditor/maskPainter';
import type { StrokePainter } from '@/pages/ClothingImageEditor/maskPainter';
import type {
  EditorRenderer,
  RenderOptions,
} from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import { cloneCanvas } from '@/pages/ClothingImageEditor/renderer/loadEditorSources';
import { createMaskUploader } from '@/pages/ClothingImageEditor/renderer/maskUploader';
import type { MaskUploader } from '@/pages/ClothingImageEditor/renderer/maskUploader';

interface UseBrushStrokesParams {
  // 붓질할 편집용 마스크다.
  mask: HTMLCanvasElement | null;
  // 처음 기준 마스크다. 읽기만 하고, 넘친 획을 구울 때 사본을 만든다.
  baseMask: HTMLCanvasElement;
  mode: BrushMode;
  renderOptions: RenderOptions;
}

interface ActiveStroke {
  stroke: BrushStroke;
  points: Point[];
  painter: StrokePainter;
  paintedRect: Rect | null;
}

interface BaseMask {
  canvas: HTMLCanvasElement;
  isOwned: boolean;
}

const getMaskContext = (mask: HTMLCanvasElement | null) =>
  mask?.getContext('2d', { willReadFrequently: true }) ?? null;

const getMaskSize = (mask: HTMLCanvasElement): Size => ({
  width: mask.width,
  height: mask.height,
});

/*
 * 편집용 마스크에 획을 칠하고, 실행 취소·다시 실행 기록과 GPU 반영을 맡는다.
 * 기록은 획의 경로만 들고, 실행 취소는 기준 마스크에서 남은 획을 다시 그려 만든다.
 */
const useBrushStrokes = (params: UseBrushStrokesParams) => {
  const { mask, baseMask, mode, renderOptions } = params;

  const [history, setHistory] = useState<BrushHistory>(EMPTY_BRUSH_HISTORY);
  // 마스크 내용이 바뀔 때마다 오른다. 저장을 이어 보낼지 판단할 때 쓴다.
  const [revision, setRevision] = useState(0);
  const historyRef = useRef<BrushHistory>(EMPTY_BRUSH_HISTORY);
  const baseRef = useRef<BaseMask>({ canvas: baseMask, isOwned: false });
  const activeStrokeRef = useRef<ActiveStroke | null>(null);
  const uploaderRef = useRef<MaskUploader | null>(null);
  const modeRef = useRef(mode);
  const renderOptionsRef = useRef(renderOptions);

  useEffect(() => {
    modeRef.current = mode;
    renderOptionsRef.current = renderOptions;
  }, [mode, renderOptions]);

  useEffect(() => {
    return () => {
      uploaderRef.current?.dispose();
      uploaderRef.current = null;
    };
  }, []);

  const commitHistory = (nextHistory: BrushHistory) => {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setRevision((current) => current + 1);
  };

  const attachRenderer = useCallback(
    (renderer: EditorRenderer | null) => {
      uploaderRef.current?.dispose();
      uploaderRef.current =
        renderer === null || mask === null
          ? null
          : createMaskUploader({
              renderer,
              mask,
              getRenderOptions: () => renderOptionsRef.current,
            });
    },
    [mask],
  );

  const bake = (strokes: readonly BrushStroke[]) => {
    if (strokes.length === 0) {
      return;
    }

    const base = baseRef.current;
    const canvas = base.isOwned ? base.canvas : cloneCanvas(base.canvas);
    baseRef.current = { canvas, isOwned: true };
    const context = getMaskContext(canvas);

    if (context === null) {
      return;
    }

    for (const stroke of strokes) {
      paintStroke(context, stroke, getMaskSize(canvas));
    }
  };

  const handleStrokeStart = (start: BrushStrokeStart) => {
    const context = getMaskContext(mask);

    if (mask === null || context === null) {
      return;
    }

    const stroke: BrushStroke = {
      mode: modeRef.current,
      radius: start.radius,
      points: [],
    };
    const painter = createStrokePainter(context, stroke, getMaskSize(mask));
    const paintedRect = painter.paint([start.point]);
    activeStrokeRef.current = {
      stroke,
      points: [start.point],
      painter,
      paintedRect,
    };
    uploaderRef.current?.markDirty(paintedRect);
  };

  const handleStrokePoints = (points: readonly Point[]) => {
    const active = activeStrokeRef.current;

    if (active === null || points.length === 0) {
      return;
    }

    const rect = active.painter.paint(points);
    active.points.push(...points);
    active.paintedRect = unionRects(active.paintedRect, rect);
    uploaderRef.current?.markDirty(rect);
  };

  const handleStrokeEnd = () => {
    const active = activeStrokeRef.current;
    activeStrokeRef.current = null;

    // 그림 밖에서만 움직인 획은 마스크를 바꾸지 않았으므로 기록하지 않는다.
    if (active === null || active.paintedRect === null) {
      return;
    }

    const { history: nextHistory, overflow } = pushStroke(historyRef.current, {
      ...active.stroke,
      points: active.points,
    });
    bake(overflow);
    commitHistory(nextHistory);
  };

  const redrawMask = (strokes: readonly BrushStroke[], shouldUpload = true) => {
    const context = getMaskContext(mask);

    if (mask === null || context === null) {
      return;
    }

    copyMask(context, baseRef.current.canvas);

    for (const stroke of strokes) {
      paintStroke(context, stroke, getMaskSize(mask));
    }

    if (shouldUpload) {
      uploaderRef.current?.markAllDirty();
    }
  };

  const undo = () => {
    if (activeStrokeRef.current !== null) {
      return;
    }

    const { history: nextHistory, stroke } = undoStroke(historyRef.current);

    if (stroke === null) {
      return;
    }

    redrawMask(nextHistory.strokes);
    commitHistory(nextHistory);
  };

  const redo = () => {
    const context = getMaskContext(mask);

    if (activeStrokeRef.current !== null || mask === null || context === null) {
      return;
    }

    const { history: nextHistory, stroke } = redoStroke(historyRef.current);

    if (stroke === null) {
      return;
    }

    uploaderRef.current?.markDirty(
      paintStroke(context, stroke, getMaskSize(mask)),
    );
    commitHistory(nextHistory);
  };

  // [원래대로]: 기록을 모두 버리고, 주어진 마스크(기본 마스크)를 새 기준으로 삼아 편집용 마스크에 덮어쓴다.
  const reset = (nextBaseMask: HTMLCanvasElement) => {
    activeStrokeRef.current = null;
    baseRef.current = { canvas: nextBaseMask, isOwned: false };
    // 원래대로는 편집 상태의 maskVersion이 올라 미리보기가 마스크 전체를 다시 올리므로 여기서는 올리지 않는다.
    redrawMask([], false);
    commitHistory(EMPTY_BRUSH_HISTORY);
  };

  const isStrokeActive = () => activeStrokeRef.current !== null;

  return {
    history,
    revision,
    isStrokeActive,
    isUndoAvailable: canUndoStroke(history),
    isRedoAvailable: canRedoStroke(history),
    attachRenderer,
    handleStrokeStart,
    handleStrokePoints,
    handleStrokeEnd,
    undo,
    redo,
    reset,
  };
};

export default useBrushStrokes;
