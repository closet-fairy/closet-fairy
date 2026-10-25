import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import BrushSurface from './BrushSurface';
import type { BrushStrokeStart } from './BrushSurface';
import { DEFAULT_BRUSH_VIEW } from './brushView';
import type { BrushView } from './brushView';

interface StatefulSurfaceProps {
  initialView?: BrushView;
  isDisabled?: boolean;
  onViewChange?: (view: BrushView) => void;
  onStrokeStart?: (start: BrushStrokeStart) => void;
  onStrokePoints?: (points: unknown) => void;
  onStrokeEnd?: () => void;
}

const StatefulSurface = (props: StatefulSurfaceProps) => {
  const {
    initialView = DEFAULT_BRUSH_VIEW,
    isDisabled,
    onViewChange,
    onStrokeStart,
    onStrokePoints,
    onStrokeEnd,
  } = props;
  const [view, setView] = useState(initialView);
  const targetRef = useRef<HTMLCanvasElement>(null);

  return (
    <BrushSurface
      targetRef={targetRef}
      maskSize={{ width: 200, height: 100 }}
      quarterTurns={0}
      brushSize={20}
      view={view}
      onViewChange={(nextView) => {
        onViewChange?.(nextView);
        setView(nextView);
      }}
      isDisabled={isDisabled}
      onStrokeStart={onStrokeStart}
      onStrokePoints={onStrokePoints}
      onStrokeEnd={onStrokeEnd}
    >
      <canvas ref={targetRef} />
    </BrushSurface>
  );
};

const getSurface = () =>
  screen.getByRole('group', { name: '브러시 그리기 영역' });

const press = (
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType = 'touch',
) => {
  fireEvent.pointerDown(getSurface(), {
    pointerId,
    pointerType,
    button: 0,
    clientX,
    clientY,
  });
};

const move = (pointerId: number, clientX: number, clientY: number) => {
  fireEvent.pointerMove(getSurface(), { pointerId, clientX, clientY });
};

const release = (pointerId: number) => {
  fireEvent.pointerUp(getSurface(), { pointerId });
};

/*
 * 500×400 표면 가운데 (50, 100)~(450, 300)에 200×100 마스크를 2배로 그린 상황이다.
 * 확대·이동이 없으므로 그림 층도 표면과 같은 자리다.
 */
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      return this instanceof HTMLCanvasElement
        ? new DOMRect(50, 100, 400, 200)
        : new DOMRect(0, 0, 500, 400);
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('마우스로 그리기', () => {
  test('누르면 바로 마스크 좌표와 마스크 반지름으로 획을 시작해야 한다.', () => {
    const handleStart = vi.fn();
    render(<StatefulSurface onStrokeStart={handleStart} />);

    press(1, 250, 200, 'mouse');

    expect(handleStart).toHaveBeenCalledWith({ point: [100, 50], radius: 5 });
  });

  test('움직인 점을 마스크 좌표로 알리고 떼면 획을 마쳐야 한다.', () => {
    const handlePoints = vi.fn();
    const handleEnd = vi.fn();
    render(
      <StatefulSurface onStrokePoints={handlePoints} onStrokeEnd={handleEnd} />,
    );

    press(1, 250, 200, 'mouse');
    move(1, 450, 200);
    release(1);

    expect(handlePoints).toHaveBeenCalledWith([[200, 50]]);
    expect(handleEnd).toHaveBeenCalledTimes(1);
  });

  test('비활성이면 그리지 않아야 한다.', () => {
    const handleStart = vi.fn();
    render(<StatefulSurface isDisabled onStrokeStart={handleStart} />);

    press(1, 250, 200, 'mouse');

    expect(handleStart).not.toHaveBeenCalled();
  });
});

describe('손가락으로 그리기', () => {
  test('첫 손가락의 획은 잠깐 보류했다가 모은 점부터 그려야 한다.', () => {
    vi.useFakeTimers();
    const handleStart = vi.fn();
    const handlePoints = vi.fn();
    render(
      <StatefulSurface
        onStrokeStart={handleStart}
        onStrokePoints={handlePoints}
      />,
    );

    press(1, 250, 200);
    move(1, 260, 200);

    expect(handleStart).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(handleStart).toHaveBeenCalledWith({ point: [100, 50], radius: 5 });
    expect(handlePoints).toHaveBeenCalledWith([[105, 50]]);
  });

  test('보류 중에 손을 떼면 점 하나를 칠하고 획을 마쳐야 한다.', () => {
    vi.useFakeTimers();
    const handleStart = vi.fn();
    const handleEnd = vi.fn();
    render(
      <StatefulSurface onStrokeStart={handleStart} onStrokeEnd={handleEnd} />,
    );

    press(1, 250, 200);
    release(1);

    expect(handleStart).toHaveBeenCalledTimes(1);
    expect(handleEnd).toHaveBeenCalledTimes(1);
  });

  test('보류 중에 두 번째 손가락이 오면 획을 버리고 확대해야 한다.', () => {
    vi.useFakeTimers();
    const handleStart = vi.fn();
    const handleViewChange = vi.fn();
    render(
      <StatefulSurface
        onStrokeStart={handleStart}
        onViewChange={handleViewChange}
      />,
    );

    press(1, 200, 200);
    press(2, 300, 200);
    move(1, 150, 200);
    move(2, 350, 200);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    release(1);
    release(2);

    expect(handleStart).not.toHaveBeenCalled();
    expect(handleViewChange).toHaveBeenLastCalledWith({
      zoom: 2,
      x: -250,
      y: -200,
    });
  });

  test('그리던 중에 두 번째 손가락이 오면 그린 데까지 획을 마쳐야 한다.', () => {
    vi.useFakeTimers();
    const handleEnd = vi.fn();
    render(<StatefulSurface onStrokeEnd={handleEnd} />);

    press(1, 250, 200);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    press(2, 300, 200);

    expect(handleEnd).toHaveBeenCalledTimes(1);
  });
});

describe('휠과 확대율', () => {
  test('Ctrl + 휠은 페이지 확대를 막고 커서 기준으로 확대해야 한다.', () => {
    const handleViewChange = vi.fn<(view: BrushView) => void>();
    render(<StatefulSurface onViewChange={handleViewChange} />);

    const isNotPrevented = fireEvent.wheel(getSurface(), {
      ctrlKey: true,
      deltaY: -50,
      clientX: 250,
      clientY: 200,
    });

    expect(isNotPrevented).toBe(false);
    expect(handleViewChange.mock.lastCall?.[0].zoom).toBeCloseTo(Math.exp(0.5));
  });

  test('1배에서 휠로 움직여도 가운데에 고정되어야 한다.', () => {
    const handleViewChange = vi.fn();
    render(<StatefulSurface onViewChange={handleViewChange} />);

    fireEvent.wheel(getSurface(), { deltaY: 100 });

    expect(handleViewChange).not.toHaveBeenCalled();
  });

  test('확대율을 보여 주고, 누르면 화면 맞춤으로 돌아가야 한다.', () => {
    const handleViewChange = vi.fn();
    render(
      <StatefulSurface
        initialView={{ zoom: 2.5, x: -375, y: -300 }}
        onViewChange={handleViewChange}
      />,
    );

    const chip = screen.getByRole('button', { name: /화면에 맞추기/ });
    expect(chip).toHaveTextContent('250%');

    fireEvent.click(chip);

    expect(handleViewChange).toHaveBeenCalledWith(DEFAULT_BRUSH_VIEW);
    expect(chip).toHaveTextContent('100%');
  });
});
