import { describe, expect, test } from 'vitest';
import type { BrushStroke } from './brush';
import {
  canRedoStroke,
  canUndoStroke,
  EMPTY_BRUSH_HISTORY,
  getBrushMaskStatus,
  MAX_BRUSH_HISTORY,
  pushStroke,
  redoStroke,
  undoStroke,
} from './brushHistory';
import type { BrushHistory } from './brushHistory';

const createStroke = (index: number): BrushStroke => ({
  mode: 'erase',
  radius: 10,
  points: [[index, index]],
});

const pushStrokes = (count: number) => {
  let history: BrushHistory = EMPTY_BRUSH_HISTORY;
  const overflow: BrushStroke[] = [];

  for (let index = 0; index < count; index += 1) {
    const pushed = pushStroke(history, createStroke(index));
    history = pushed.history;
    overflow.push(...pushed.overflow);
  }

  return { history, overflow };
};

describe('획 기록', () => {
  test('획을 더하면 실행 취소할 수 있어야 한다.', () => {
    const { history } = pushStrokes(1);

    expect(canUndoStroke(history)).toBe(true);
    expect(canRedoStroke(history)).toBe(false);
  });

  test('50개를 넘으면 가장 오래된 획을 넘쳐 나온 획으로 돌려줘야 한다.', () => {
    const { history, overflow } = pushStrokes(MAX_BRUSH_HISTORY + 2);

    expect(history.strokes).toHaveLength(MAX_BRUSH_HISTORY);
    expect(history.strokes[0]).toEqual(createStroke(2));
    expect(overflow).toEqual([createStroke(0), createStroke(1)]);
    expect(history.hasBakedStrokes).toBe(true);
  });

  test('50개까지는 넘쳐 나온 획이 없어야 한다.', () => {
    const { history, overflow } = pushStrokes(MAX_BRUSH_HISTORY);

    expect(overflow).toEqual([]);
    expect(history.hasBakedStrokes).toBe(false);
  });
});

describe('실행 취소와 다시 실행', () => {
  test('실행 취소는 마지막 획을 꺼내 다시 실행 기록으로 옮겨야 한다.', () => {
    const { history } = pushStrokes(2);
    const undone = undoStroke(history);

    expect(undone.stroke).toEqual(createStroke(1));
    expect(undone.history.strokes).toEqual([createStroke(0)]);
    expect(canRedoStroke(undone.history)).toBe(true);
  });

  test('다시 실행은 마지막으로 취소한 획을 되돌려 놓아야 한다.', () => {
    const { history } = pushStrokes(2);
    const undoneTwice = undoStroke(undoStroke(history).history).history;
    const redone = redoStroke(undoneTwice);

    expect(redone.stroke).toEqual(createStroke(0));
    expect(redone.history.strokes).toEqual([createStroke(0)]);
    expect(redone.history.redoStrokes).toEqual([createStroke(1)]);
  });

  test('새 획을 그리면 다시 실행 기록을 지워야 한다.', () => {
    const { history } = pushStrokes(2);
    const undone = undoStroke(history).history;
    const pushed = pushStroke(undone, createStroke(9)).history;

    expect(canRedoStroke(pushed)).toBe(false);
  });

  test('기록이 없으면 아무것도 바꾸지 않아야 한다.', () => {
    expect(undoStroke(EMPTY_BRUSH_HISTORY)).toEqual({
      history: EMPTY_BRUSH_HISTORY,
      stroke: null,
    });
    expect(redoStroke(EMPTY_BRUSH_HISTORY)).toEqual({
      history: EMPTY_BRUSH_HISTORY,
      stroke: null,
    });
  });
});

describe('마스크 상태 계산', () => {
  test('남은 획이 있으면 편집됨이어야 한다.', () => {
    expect(getBrushMaskStatus(pushStrokes(1).history, 'initial')).toBe(
      'edited',
    );
  });

  test('모두 취소하면 기준 마스크의 상태로 돌아가야 한다.', () => {
    const undone = undoStroke(pushStrokes(1).history).history;

    expect(getBrushMaskStatus(undone, 'initial')).toBe('initial');
    expect(getBrushMaskStatus(undone, 'default')).toBe('default');
  });

  test('구워 넣은 획이 있으면 모두 취소해도 편집됨이어야 한다.', () => {
    let { history } = pushStrokes(MAX_BRUSH_HISTORY + 1);

    while (canUndoStroke(history)) {
      history = undoStroke(history).history;
    }

    expect(getBrushMaskStatus(history, 'initial')).toBe('edited');
  });
});
