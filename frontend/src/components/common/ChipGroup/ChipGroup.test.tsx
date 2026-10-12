import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Chip from '@/components/common/Chip';
import ChipGroup from './ChipGroup';

const renderSituationChips = (onChange: (value: string) => void) =>
  render(
    <ChipGroup aria-label="상황" value="데일리" onChange={onChange}>
      <Chip value="데일리">데일리</Chip>
      <Chip value="출근">출근</Chip>
    </ChipGroup>,
  );

describe('칩 단일 선택', () => {
  test('이미 선택된 칩을 다시 누르면 선택이 해제되지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderSituationChips(handleChange);

    const dailyChip = screen.getByRole('button', { name: '데일리' });
    await user.click(dailyChip);

    expect(handleChange).not.toHaveBeenCalled();
    expect(dailyChip).toHaveAttribute('aria-pressed', 'true');
  });

  test('다른 칩을 누르면 그 칩의 값으로 선택 변경을 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderSituationChips(handleChange);

    await user.click(screen.getByRole('button', { name: '출근' }));

    expect(handleChange).toHaveBeenCalledWith('출근');
  });
});
