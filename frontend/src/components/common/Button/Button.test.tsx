import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Button from './Button';

describe('로딩 상태', () => {
  test('로딩 중에 누르면 onClick을 호출하지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        저장
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(handleClick).not.toHaveBeenCalled();
  });

  test('로딩 중이면 스크린리더에 처리 중이고 누를 수 없다고 알려야 한다.', () => {
    render(<Button isLoading>저장</Button>);

    const button = screen.getByRole('button', { name: '저장' });

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  test('로딩이 끝나면 다시 onClick을 호출해야 한다.', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const { rerender } = render(
      <Button isLoading onClick={handleClick}>
        저장
      </Button>,
    );

    rerender(<Button onClick={handleClick}>저장</Button>);
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
