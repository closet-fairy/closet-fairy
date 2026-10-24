import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';
import BrushPanel from './BrushPanel';

const renderPanel = (
  overrides: Partial<ComponentProps<typeof BrushPanel>> = {},
) => {
  const props: ComponentProps<typeof BrushPanel> = {
    mode: 'erase',
    onModeChange: vi.fn(),
    brushSize: 20,
    onBrushSizeChange: vi.fn(),
    isUndoAvailable: true,
    isRedoAvailable: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    ...overrides,
  };
  render(<BrushPanel {...props} />);

  return props;
};

describe('브러시 모드', () => {
  test('되살리기를 누르면 되살리기 모드로 바꾸라고 알려야 한다.', async () => {
    const user = userEvent.setup();
    const { onModeChange } = renderPanel();

    await user.click(screen.getByRole('button', { name: '되살리기' }));

    expect(onModeChange).toHaveBeenCalledWith('restore');
  });

  test('되살리기를 쓸 수 없으면 안내를 보이고 모드 전환을 막아야 한다.', () => {
    renderPanel({ isRestoreAvailable: false });

    expect(
      screen.getByText('원본을 불러오지 못해 되살리기를 쓸 수 없어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '되살리기' })).toBeDisabled();
  });
});

describe('실행 취소와 다시 실행', () => {
  test('기록이 없는 쪽 버튼은 비활성이어야 한다.', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: '실행 취소' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '다시 실행' })).toBeDisabled();
  });

  test('실행 취소를 누르면 알려야 한다.', async () => {
    const user = userEvent.setup();
    const { onUndo } = renderPanel();

    await user.click(screen.getByRole('button', { name: '실행 취소' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

describe('붓 크기', () => {
  test('지금 붓 크기를 px로 보여 줘야 한다.', () => {
    renderPanel({ brushSize: 36 });

    expect(screen.getByText('36px')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '붓 크기' })).toHaveValue('36');
  });
});

describe('비활성', () => {
  test('저장 중에는 모든 조작을 막아야 한다.', () => {
    renderPanel({ isDisabled: true, isRedoAvailable: true });

    expect(screen.getByRole('button', { name: '지우기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다시 실행' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: '붓 크기' })).toBeDisabled();
  });
});
