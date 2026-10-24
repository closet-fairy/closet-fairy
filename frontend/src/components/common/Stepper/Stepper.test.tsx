import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Stepper from './Stepper';

const STEPS = [
  { value: 'brush', label: '브러시' },
  { value: 'perspective', label: '원근' },
  { value: 'rotation', label: '회전' },
];

describe('단계 이동', () => {
  test('지금 단계에만 현재 단계 표시가 붙어야 한다.', () => {
    render(
      <Stepper
        aria-label="편집 단계"
        steps={STEPS}
        value="perspective"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '원근' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('button', { name: '브러시' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  test('순서와 상관없이 다른 단계를 누르면 그 단계의 값만 넘겨 변경을 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Stepper
        aria-label="편집 단계"
        steps={STEPS}
        value="brush"
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '회전' }));

    expect(handleChange).toHaveBeenCalledWith('rotation');
    expect(handleChange.mock.calls[0]).toHaveLength(1);
  });

  test('비활성 상태에서는 단계를 눌러도 변경을 알리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Stepper
        aria-label="편집 단계"
        steps={STEPS}
        value="brush"
        onChange={handleChange}
        isDisabled
      />,
    );

    await user.click(screen.getByRole('button', { name: '회전' }));

    expect(handleChange).not.toHaveBeenCalled();
  });

  test('지금 단계를 다시 누르면 변경을 알리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Stepper
        aria-label="편집 단계"
        steps={STEPS}
        value="brush"
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '브러시' }));

    expect(handleChange).not.toHaveBeenCalled();
  });
});
