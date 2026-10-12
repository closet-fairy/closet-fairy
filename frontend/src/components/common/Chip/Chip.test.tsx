import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ChipGroup from '@/components/common/ChipGroup';
import Chip from './Chip';

const renderCustomChip = (
  value: string,
  onChange: (value: string) => void,
  onClick: () => void,
) =>
  render(
    <ChipGroup aria-label="상황" value={value} onChange={onChange}>
      <Chip value="데일리">데일리</Chip>
      <Chip value="custom" variant="dashed" onClick={onClick}>
        학교 발표
      </Chip>
    </ChipGroup>,
  );

describe('다른 동작으로 이어지는 칩', () => {
  test('onClick을 넘긴 칩을 누르면 선택을 바꾸지 않고 onClick만 호출해야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleClick = vi.fn();
    renderCustomChip('데일리', handleChange, handleClick);

    const customChip = screen.getByRole('button', { name: '학교 발표' });
    await user.click(customChip);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleChange).not.toHaveBeenCalled();
    expect(customChip).toHaveAttribute('aria-pressed', 'false');
  });

  test('onClick을 넘긴 칩이 이미 선택되어 있어도 다시 누르면 onClick을 호출하고 선택을 유지해야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleClick = vi.fn();
    renderCustomChip('custom', handleChange, handleClick);

    const customChip = screen.getByRole('button', { name: '학교 발표' });
    await user.click(customChip);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleChange).not.toHaveBeenCalled();
    expect(customChip).toHaveAttribute('aria-pressed', 'true');
  });
});
