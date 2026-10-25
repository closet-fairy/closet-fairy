import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import CheckList from './CheckList';

const ITEMS = [
  { value: 'minimal', label: '미니멀', description: '단정하고 군더더기 없는' },
  { value: 'casual', label: '캐주얼' },
];

describe('여러 항목 선택', () => {
  test('고르지 않은 항목을 누르면 기존 선택에 더한 배열로 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <CheckList
        aria-label="선호 스타일"
        items={ITEMS}
        value={['minimal']}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /캐주얼/ }));

    expect(handleChange).toHaveBeenCalledWith(['minimal', 'casual']);
  });

  test('고른 항목을 다시 누르면 그 항목을 뺀 배열로 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <CheckList
        aria-label="선호 스타일"
        items={ITEMS}
        value={['minimal', 'casual']}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /미니멀/ }));

    expect(handleChange).toHaveBeenCalledWith(['casual']);
  });

  test('선택된 항목은 눌린 상태로 알려야 한다.', () => {
    render(
      <CheckList
        aria-label="선호 스타일"
        items={ITEMS}
        value={['casual']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /캐주얼/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /미니멀/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
