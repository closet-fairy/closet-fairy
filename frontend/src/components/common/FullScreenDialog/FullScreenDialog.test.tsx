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

  test('다이얼로그 바깥을 눌러도 닫힘을 요청하지 않아야 한다.', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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
    await user.click(document.body);

    expect(handleOpenChange).not.toHaveBeenCalled();
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

  test('닫기 모양을 고르면 닫기 버튼을 눌러 닫힘을 요청해야 한다.', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <FullScreenDialog
        isOpen
        onOpenChange={handleOpenChange}
        title="옷 촬영"
        closeButton="close"
      >
        본문
      </FullScreenDialog>,
    );

    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(
      screen.queryByRole('button', { name: '뒤로 가기' }),
    ).not.toBeInTheDocument();
  });
});

describe('하단 고정 영역', () => {
  test('footer를 넘기면 그 내용을 함께 보여야 한다.', async () => {
    render(
      <FullScreenDialog
        isOpen
        onOpenChange={vi.fn()}
        title="사진 확인"
        footer={<button type="button">4벌 등록하기</button>}
      >
        본문
      </FullScreenDialog>,
    );

    expect(
      await screen.findByRole('button', { name: '4벌 등록하기' }),
    ).toBeInTheDocument();
  });
});
