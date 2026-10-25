import type { BrushStroke } from './brush';
import type { MaskStatus } from './saveRequests';

export const MAX_BRUSH_HISTORY = 50;

export interface BrushHistory {
  strokes: readonly BrushStroke[];
  redoStrokes: readonly BrushStroke[];
  // 기록이 넘쳐 기준 마스크에 구워 넣은 획이 있는지다. 구운 획은 되돌릴 수 없다.
  hasBakedStrokes: boolean;
}

export type BaseMaskStatus = Exclude<MaskStatus, 'edited'>;

export const EMPTY_BRUSH_HISTORY: BrushHistory = {
  strokes: [],
  redoStrokes: [],
  hasBakedStrokes: false,
};

// 넘친 획(overflow)은 부르는 쪽이 기준 마스크에 순서대로 구워 넣는다.
export const pushStroke = (
  history: BrushHistory,
  stroke: BrushStroke,
): { history: BrushHistory; overflow: BrushStroke[] } => {
  const strokes = [...history.strokes, stroke];
  const overflowCount = Math.max(0, strokes.length - MAX_BRUSH_HISTORY);

  return {
    history: {
      strokes: strokes.slice(overflowCount),
      redoStrokes: [],
      hasBakedStrokes: history.hasBakedStrokes || overflowCount > 0,
    },
    overflow: strokes.slice(0, overflowCount),
  };
};

export const undoStroke = (
  history: BrushHistory,
): { history: BrushHistory; stroke: BrushStroke | null } => {
  const stroke = history.strokes.at(-1);

  if (stroke === undefined) {
    return { history, stroke: null };
  }

  return {
    history: {
      ...history,
      strokes: history.strokes.slice(0, -1),
      redoStrokes: [...history.redoStrokes, stroke],
    },
    stroke,
  };
};

export const redoStroke = (
  history: BrushHistory,
): { history: BrushHistory; stroke: BrushStroke | null } => {
  const stroke = history.redoStrokes.at(-1);

  if (stroke === undefined) {
    return { history, stroke: null };
  }

  return {
    history: {
      ...history,
      strokes: [...history.strokes, stroke],
      redoStrokes: history.redoStrokes.slice(0, -1),
    },
    stroke,
  };
};

export const canUndoStroke = (history: BrushHistory) =>
  history.strokes.length > 0;

export const canRedoStroke = (history: BrushHistory) =>
  history.redoStrokes.length > 0;

// 획을 다 취소하면 기준 마스크의 상태로 돌아가, 바뀐 게 없는 편집으로 본다.
export const getBrushMaskStatus = (
  history: BrushHistory,
  baseStatus: BaseMaskStatus,
): MaskStatus =>
  history.strokes.length > 0 || history.hasBakedStrokes ? 'edited' : baseStatus;
