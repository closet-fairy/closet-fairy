import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import BottomSheet from './BottomSheet';

describe('바텀시트 닫기', () => {
  test('닫기를 막은 상태에서는 Esc를 눌러도 닫힘 요청이 나가지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    render(
      <BottomSheet
        isOpen
        onOpenChange={handleOpenChange}
        title="위치 설정"
        isDismissable={false}
      >
        본문
      </BottomSheet>,
    );

    await screen.findByRole('dialog', { name: '위치 설정' });
    await user.keyboard('{Escape}');

    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: '위치 설정' }),
    ).toBeInTheDocument();
  });

  test('기본 상태에서는 Esc를 누르면 닫힘 요청이 나가야 한다.', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    render(
      <BottomSheet isOpen onOpenChange={handleOpenChange} title="위치 설정">
        본문
      </BottomSheet>,
    );

    await screen.findByRole('dialog', { name: '위치 설정' });
    await user.keyboard('{Escape}');

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('열 때 포커스 위치', () => {
  const sheetChildren = <input aria-label="상황" />;

  test('터치로 열면 시트 자체에 포커스가 가야 한다.', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <BottomSheet
        isOpen={false}
        onOpenChange={vi.fn()}
        title="어떤 상황인가요"
      >
        {sheetChildren}
      </BottomSheet>,
    );

    await user.pointer({ keys: '[TouchA]', target: document.body });
    rerender(
      <BottomSheet isOpen onOpenChange={vi.fn()} title="어떤 상황인가요">
        {sheetChildren}
      </BottomSheet>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: '어떤 상황인가요' }),
      ).toHaveFocus();
    });
  });

  test('키보드로 열면 첫 번째 포커스 가능한 요소에 포커스가 가야 한다.', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <BottomSheet
        isOpen={false}
        onOpenChange={vi.fn()}
        title="어떤 상황인가요"
      >
        {sheetChildren}
      </BottomSheet>,
    );

    await user.keyboard('{Enter}');
    rerender(
      <BottomSheet isOpen onOpenChange={vi.fn()} title="어떤 상황인가요">
        {sheetChildren}
      </BottomSheet>,
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: '상황' })).toHaveFocus();
    });
  });
});
