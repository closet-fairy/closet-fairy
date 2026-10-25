import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import FullScreenDialog from './FullScreenDialog';

describe('닫기', () => {
  test('뒤로 가기 버튼을 누르면 닫힘을 요청해야 한다.', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <FullScreenDialog
        isOpen
        onOpenChange={handleOpenChange}
        title="주소 입력"
      >
        본문
      </FullScreenDialog>,
    );

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  test('Esc를 누르면 닫힘을 요청해야 한다.', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <FullScreenDialog
        isOpen
        onOpenChange={handleOpenChange}
        title="주소 입력"
      >
        본문
      </FullScreenDialog>,
    );

    await screen.findByRole('dialog', { name: '주소 입력' });
    await user.keyboard('{Escape}');

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
