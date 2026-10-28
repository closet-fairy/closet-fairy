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

describe('선택 해제를 허용한 칩 묶음', () => {
  const renderGenderChips = (onChange: (value: string | null) => void) =>
    render(
      <ChipGroup
        aria-label="성별"
        value="여"
        isDeselectable
        onChange={onChange}
      >
        <Chip value="남">남</Chip>
        <Chip value="여">여</Chip>
      </ChipGroup>,
    );

  test('이미 선택된 칩을 다시 누르면 선택 해제를 null로 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderGenderChips(handleChange);

    await user.click(screen.getByRole('button', { name: '여' }));

    expect(handleChange).toHaveBeenCalledWith(null);
  });

  test('다른 칩을 누르면 그 칩의 값으로 선택 변경을 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderGenderChips(handleChange);

    await user.click(screen.getByRole('button', { name: '남' }));

    expect(handleChange).toHaveBeenCalledWith('남');
  });
});

describe('여러 개를 고르는 칩 묶음', () => {
  const renderMultiple = (value: string[]) => {
    const onChange = vi.fn();
    render(
      <ChipGroup isMultiple value={value} onChange={onChange} aria-label="계절">
        <Chip value="spring">봄</Chip>
        <Chip value="summer">여름</Chip>
        <Chip value="fall">가을</Chip>
      </ChipGroup>,
    );

    return { onChange };
  };

  test('선택되지 않은 칩을 누르면 이미 고른 값에 더해 알려야 한다.', async () => {
    const user = userEvent.setup();
    const { onChange } = renderMultiple(['spring']);

    await user.click(screen.getByRole('button', { name: '여름' }));

    expect(onChange).toHaveBeenCalledWith(['spring', 'summer']);
  });

  test('선택된 칩을 다시 누르면 그 값만 빼고 알려야 한다.', async () => {
    const user = userEvent.setup();
    const { onChange } = renderMultiple(['spring', 'fall']);

    await user.click(screen.getByRole('button', { name: '봄' }));

    expect(onChange).toHaveBeenCalledWith(['fall']);
  });

  test('고른 값마다 칩이 눌린 상태로 보여야 한다.', () => {
    renderMultiple(['spring', 'fall']);

    expect(screen.getByRole('button', { name: '봄' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '여름' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: '가을' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
