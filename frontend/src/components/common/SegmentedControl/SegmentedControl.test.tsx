import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import SegmentedControl from './SegmentedControl';

const OPTIONS = [
  { value: 'erase', label: '지우기' },
  { value: 'restore', label: '되살리기' },
];

describe('항목 선택', () => {
  test('선택된 항목을 다시 누르면 선택이 해제되지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="브러시 모드"
        options={OPTIONS}
        value="erase"
        onChange={handleChange}
      />,
    );

    const eraseButton = screen.getByRole('button', { name: '지우기' });
    await user.click(eraseButton);

    expect(handleChange).not.toHaveBeenCalled();
    expect(eraseButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('다른 항목을 누르면 그 항목의 값만 넘겨 변경을 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="브러시 모드"
        options={OPTIONS}
        value="erase"
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '되살리기' }));

    expect(handleChange).toHaveBeenCalledWith('restore');
    expect(handleChange.mock.calls[0]).toHaveLength(1);
  });
});
