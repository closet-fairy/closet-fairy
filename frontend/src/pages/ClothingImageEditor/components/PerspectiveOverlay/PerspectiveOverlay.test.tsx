import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import type { Quad } from '@/domains/clothingImageEdit/types';
import PerspectiveOverlay from './PerspectiveOverlay';

interface StatefulOverlayProps {
  onChange?: (corners: Quad) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  isDisabled?: boolean;
}

const StatefulOverlay = (props: StatefulOverlayProps) => {
  const { onChange, onDraggingChange, isDisabled } = props;
  const [corners, setCorners] = useState<Quad>(DEFAULT_CORNERS);

  return (
    <PerspectiveOverlay
      corners={corners}
      quarterTurns={0}
      onChange={(nextCorners) => {
        onChange?.(nextCorners);
        setCorners(nextCorners);
      }}
      onDraggingChange={onDraggingChange}
      magnifierSource={null}
      isDisabled={isDisabled}
    />
  );
};

const getOverlay = () => screen.getByRole('group', { name: '원근 꼭짓점' });

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 200, 100),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('꼭짓점 끌기', () => {
  test('꼭짓점 근처를 눌러 끌면 처음 간격을 유지한 자리로 옮겼다고 알려야 한다.', () => {
    const handleChange = vi.fn();
    render(<StatefulOverlay onChange={handleChange} />);

    fireEvent.pointerDown(getOverlay(), {
      button: 0,
      pointerId: 1,
      clientX: 196,
      clientY: 96,
    });
    fireEvent.pointerMove(getOverlay(), {
      pointerId: 1,
      buttons: 1,
      clientX: 156,
      clientY: 86,
    });

    const nextCorners: unknown = handleChange.mock.lastCall?.[0];
    expect(nextCorners).toEqual([
      [0, 0],
      [1, 0],
      [expect.closeTo(0.8), expect.closeTo(0.9)],
      [0, 1],
    ]);
  });

  test('누르고 놓을 때 끄는 상태를 알려야 한다.', () => {
    const handleDraggingChange = vi.fn();
    render(<StatefulOverlay onDraggingChange={handleDraggingChange} />);

    fireEvent.pointerDown(getOverlay(), {
      button: 0,
      pointerId: 1,
      clientX: 2,
      clientY: 2,
    });
    expect(handleDraggingChange).toHaveBeenLastCalledWith(true);

    fireEvent.pointerUp(getOverlay(), { pointerId: 1 });
    expect(handleDraggingChange).toHaveBeenLastCalledWith(false);
  });

  test('끄는 중에 다른 손가락이 닿아도 처음 잡은 손가락만 따라가야 한다.', () => {
    const handleChange = vi.fn();
    const handleDraggingChange = vi.fn();
    render(
      <StatefulOverlay
        onChange={handleChange}
        onDraggingChange={handleDraggingChange}
      />,
    );

    fireEvent.pointerDown(getOverlay(), {
      button: 0,
      pointerId: 1,
      clientX: 196,
      clientY: 96,
    });
    fireEvent.pointerDown(getOverlay(), {
      button: 0,
      pointerId: 2,
      clientX: 2,
      clientY: 2,
    });
    fireEvent.pointerMove(getOverlay(), {
      pointerId: 2,
      buttons: 1,
      clientX: 40,
      clientY: 20,
    });
    fireEvent.pointerUp(getOverlay(), { pointerId: 2 });

    expect(handleChange).not.toHaveBeenCalled();
    expect(handleDraggingChange).toHaveBeenCalledTimes(1);
    expect(handleDraggingChange).toHaveBeenLastCalledWith(true);
  });

  test('꼭짓점에서 22px 넘게 떨어진 곳을 누르면 아무것도 잡지 않아야 한다.', () => {
    const handleDraggingChange = vi.fn();
    render(<StatefulOverlay onDraggingChange={handleDraggingChange} />);

    fireEvent.pointerDown(getOverlay(), {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 50,
    });

    expect(handleDraggingChange).not.toHaveBeenCalled();
  });

  test('비활성 상태에서는 꼭짓점을 잡을 수 없어야 한다.', () => {
    const handleDraggingChange = vi.fn();
    render(
      <StatefulOverlay onDraggingChange={handleDraggingChange} isDisabled />,
    );

    fireEvent.pointerDown(getOverlay(), {
      button: 0,
      pointerId: 1,
      clientX: 2,
      clientY: 2,
    });

    expect(handleDraggingChange).not.toHaveBeenCalled();
  });

  test('끄는 중에 사라지면 끄는 상태를 끝냈다고 알려야 한다.', () => {
    const handleDraggingChange = vi.fn();
    const { unmount } = render(
      <StatefulOverlay onDraggingChange={handleDraggingChange} />,
    );

    fireEvent.pointerDown(getOverlay(), {
      button: 0,
      pointerId: 1,
      clientX: 2,
      clientY: 2,
    });
    unmount();

    expect(handleDraggingChange).toHaveBeenLastCalledWith(false);
  });
});
