import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, test, vi } from 'vitest';
import Dialog from './Dialog';

describe('다이얼로그 닫기', () => {
  test('닫기를 막은 상태에서는 Esc를 눌러도 닫힘 요청이 나가지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    render(
      <Dialog
        isOpen
        onOpenChange={handleOpenChange}
        title="이 코디, 얼마나 마음에 드세요"
        isDismissable={false}
      />,
    );

    await screen.findByRole('dialog', {
      name: '이 코디, 얼마나 마음에 드세요',
    });
    await user.keyboard('{Escape}');

    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: '이 코디, 얼마나 마음에 드세요' }),
    ).toBeInTheDocument();
  });

  test('기본 상태에서는 Esc를 누르면 닫힘 요청이 나가야 한다.', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    render(
      <Dialog
        isOpen
        onOpenChange={handleOpenChange}
        title="이 코디, 얼마나 마음에 드세요"
      />,
    );

    await screen.findByRole('dialog', {
      name: '이 코디, 얼마나 마음에 드세요',
    });
    await user.keyboard('{Escape}');

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('열 때 포커스 위치', () => {
  const footer = <button type="button">확인</button>;

  test('터치로 열면 다이얼로그 자체에 포커스가 가야 한다.', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Dialog
        isOpen={false}
        onOpenChange={vi.fn()}
        title="추천을 그만 볼까요"
        footer={footer}
      />,
    );

    await user.pointer({ keys: '[TouchA]', target: document.body });
    rerender(
      <Dialog
        isOpen
        onOpenChange={vi.fn()}
        title="추천을 그만 볼까요"
        footer={footer}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: '추천을 그만 볼까요' }),
      ).toHaveFocus();
    });
  });

  test('키보드로 열면 첫 번째 포커스 가능한 요소에 포커스가 가야 한다.', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Dialog
        isOpen={false}
        onOpenChange={vi.fn()}
        title="추천을 그만 볼까요"
        footer={footer}
      />,
    );

    await user.keyboard('{Enter}');
    rerender(
      <Dialog
        isOpen
        onOpenChange={vi.fn()}
        title="추천을 그만 볼까요"
        footer={footer}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '확인' })).toHaveFocus();
    });
  });

  test('initialFocus를 넘기면 터치로 열어도 그 요소에 포커스가 가야 한다.', async () => {
    const user = userEvent.setup();
    const keepButtonRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <Dialog
        isOpen={false}
        onOpenChange={vi.fn()}
        title="추천을 그만 볼까요"
      />,
    );

    await user.pointer({ keys: '[TouchA]', target: document.body });
    rerender(
      <Dialog
        isOpen
        onOpenChange={vi.fn()}
        title="추천을 그만 볼까요"
        initialFocus={keepButtonRef}
        footer={
          <>
            <button type="button">그만 볼게요</button>
            <button type="button" ref={keepButtonRef}>
              계속 볼게요
            </button>
          </>
        }
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '계속 볼게요' })).toHaveFocus();
    });
  });
});
