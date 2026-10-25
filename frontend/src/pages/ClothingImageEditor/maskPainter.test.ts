import { describe, expect, test, vi } from 'vitest';
import type { BrushStroke } from '@/domains/clothingImageEdit/brush';
import { copyMask, createStrokePainter, paintStroke } from './maskPainter';
import type { MaskContext } from './maskPainter';

const MASK_SIZE = { width: 100, height: 100 };

const createFakeContext = () => {
  const drawn: { x: number; y: number; operation: string }[] = [];
  const context: MaskContext = {
    globalCompositeOperation: 'source-over',
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: (_image: CanvasImageSource, x: number, y: number) => {
      drawn.push({ x, y, operation: context.globalCompositeOperation });
    },
  };

  return { context, drawn };
};

const createStamp = vi.fn(() => document.createElement('canvas'));

describe('획 칠하기', () => {
  test('도장을 붓 가운데가 점에 오도록 덧칠 방식으로 찍어야 한다.', () => {
    const { context, drawn } = createFakeContext();
    const painter = createStrokePainter(
      context,
      { mode: 'erase', radius: 4 },
      MASK_SIZE,
      createStamp,
    );

    painter.paint([[20, 30]]);

    // 반지름 4의 도장은 지름 8에 여유 1px씩을 더한 10px 사각형이다.
    expect(drawn).toEqual([{ x: 15, y: 25, operation: 'source-over' }]);
    expect(createStamp).toHaveBeenCalledWith('erase', 4);
  });

  test('이어지는 점 사이를 보간해 찍고 칠한 영역을 돌려줘야 한다.', () => {
    const { context, drawn } = createFakeContext();
    const painter = createStrokePainter(
      context,
      { mode: 'restore', radius: 4 },
      MASK_SIZE,
      createStamp,
    );

    painter.paint([[10, 10]]);
    const rect = painter.paint([[20, 10]]);

    // 간격은 반지름의 25%인 1px이라 11~20에 열 번 찍는다.
    expect(drawn).toHaveLength(11);
    expect(rect).toEqual({ x: 6, y: 5, width: 19, height: 10 });
  });

  test('마스크 밖에서만 칠하면 칠한 영역이 없어야 한다.', () => {
    const { context } = createFakeContext();

    expect(
      createStrokePainter(
        context,
        { mode: 'erase', radius: 4 },
        MASK_SIZE,
        createStamp,
      ).paint([[-50, -50]]),
    ).toBeNull();
  });

  test('기록한 획을 다시 그리면 이어 그릴 때와 같은 자리에 찍어야 한다.', () => {
    const stroke: BrushStroke = {
      mode: 'erase',
      radius: 6,
      points: [
        [10, 10],
        [14, 13],
        [30, 40],
      ],
    };
    const live = createFakeContext();
    const painter = createStrokePainter(
      live.context,
      stroke,
      MASK_SIZE,
      createStamp,
    );

    for (const point of stroke.points) {
      painter.paint([point]);
    }

    const replay = createFakeContext();
    paintStroke(replay.context, stroke, MASK_SIZE, createStamp);

    expect(replay.drawn).toEqual(live.drawn);
  });
});

describe('기준 마스크 복사', () => {
  test('기존 내용과 섞지 않고 그대로 덮어써야 한다.', () => {
    const { context, drawn } = createFakeContext();

    copyMask(context, document.createElement('canvas'));

    expect(drawn).toEqual([{ x: 0, y: 0, operation: 'copy' }]);
  });
});
