import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import Slider from './Slider';

describe('키보드 조작', () => {
  test('오른쪽 방향키를 누르면 단위만큼 커진 값으로 변경을 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Slider
        aria-label="붓 크기"
        value={20}
        onChange={handleChange}
        min={4}
        max={80}
      />,
    );

    screen.getByRole('slider', { name: '붓 크기' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(handleChange).toHaveBeenCalledWith(21);
  });

  test('비활성 상태에서는 슬라이더에 초점이 가지 않아 방향키로 값을 바꿀 수 없어야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Slider
        aria-label="붓 크기"
        value={20}
        onChange={handleChange}
        min={4}
        max={80}
        isDisabled
      />,
    );

    const slider = screen.getByRole('slider', { name: '붓 크기' });
    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(slider).toBeDisabled();
    expect(slider).not.toHaveFocus();
    expect(handleChange).not.toHaveBeenCalled();
  });
});

describe('눈금 글자', () => {
  test('라벨을 준 눈금만 글자로 보여 줘야 한다.', () => {
    render(
      <Slider
        aria-label="기울기"
        value={0}
        onChange={vi.fn()}
        min={-45}
        max={45}
        marks={[
          { value: -45, label: '−45°' },
          { value: 0 },
          { value: 45, label: '45°' },
        ]}
      />,
    );

    expect(screen.getByText('−45°')).toBeInTheDocument();
    expect(screen.getByText('45°')).toBeInTheDocument();
    expect(screen.queryByText('0°')).not.toBeInTheDocument();
  });
});

describe('잡는 동안 신호', () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
  });

  test('트랙을 누르면 잡는 중을, 손을 떼면 놓았음을 차례로 알려야 한다.', () => {
    const handleDraggingChange = vi.fn();
    render(
      <Slider
        aria-label="붓 크기"
        value={20}
        onChange={vi.fn()}
        min={4}
        max={80}
        onDraggingChange={handleDraggingChange}
      />,
    );

    const slider = screen.getByRole('slider');

    fireEvent.pointerDown(slider, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(handleDraggingChange.mock.calls).toEqual([[true], [false]]);
  });

  test('비활성 상태에서는 트랙을 눌러도 잡는 중을 알리지 않아야 한다.', () => {
    const handleDraggingChange = vi.fn();
    render(
      <Slider
        aria-label="붓 크기"
        value={20}
        onChange={vi.fn()}
        min={4}
        max={80}
        isDisabled
        onDraggingChange={handleDraggingChange}
      />,
    );

    const slider = screen.getByRole('slider');

    fireEvent.pointerDown(slider, { button: 0, pointerId: 1 });

    expect(handleDraggingChange).not.toHaveBeenCalled();
  });
});
