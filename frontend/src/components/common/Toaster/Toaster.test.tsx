import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ToastProvider from '@/components/common/ToastProvider';
import {
  showToast,
  toastManager,
} from '@/components/common/ToastProvider/ToastProvider.toast';
import Toaster from './Toaster';
import { useToastStackHeight } from './Toaster.hooks';

const renderToaster = () =>
  render(
    <ToastProvider>
      <Toaster />
    </ToastProvider>,
  );

afterEach(() => {
  act(() => {
    toastManager.close();
  });
});

describe('토스트 띄우기', () => {
  test('showToast로 띄운 제목과 설명을 보여야 한다.', async () => {
    renderToaster();

    act(() => {
      showToast({
        tone: 'info',
        title: '옷을 찾을 수 없어요',
        description: '옷장으로 돌아왔어요.',
      });
    });

    expect(
      await screen.findByRole('dialog', { name: '옷을 찾을 수 없어요' }),
    ).toHaveAccessibleDescription('옷장으로 돌아왔어요.');
  });

  test('에러 토스트는 스크린리더가 곧바로 읽는 알림으로 띄워야 한다.', async () => {
    renderToaster();

    act(() => {
      showToast({ tone: 'error', title: '색상을 저장하지 못했어요' });
    });

    // 우선순위가 높은 토스트만 별도 알림 영역(role="alert")에 담긴다.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '색상을 저장하지 못했어요',
    );
  });

  test('안내 토스트는 알림 영역에 담지 않아야 한다.', async () => {
    renderToaster();

    act(() => {
      showToast({ tone: 'success', title: '옷을 삭제했어요' });
    });

    await screen.findByRole('dialog', { name: '옷을 삭제했어요' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('여러 번 띄우면 띄운 토스트가 모두 남아 있어야 한다.', async () => {
    renderToaster();

    act(() => {
      showToast({ tone: 'success', title: '옷을 삭제했어요' });
      showToast({ tone: 'info', title: '옷을 찾을 수 없어요' });
    });

    expect(
      await screen.findByRole('dialog', { name: '옷을 삭제했어요' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: '옷을 찾을 수 없어요' }),
    ).toBeInTheDocument();
  });
});

describe('토스트가 차지한 높이', () => {
  test('토스트가 없으면 높이를 주지 않아야 한다.', () => {
    const { result } = renderHook(() => useToastStackHeight(), {
      wrapper: ToastProvider,
    });

    expect(result.current).toBeNull();
  });

  test('토스트가 두 개 뜨면 맨 앞 토스트 높이에 뒤로 쌓인 한 개만큼 드러난 높이를 더해 줘야 한다.', async () => {
    const { result } = renderHook(() => useToastStackHeight(), {
      wrapper: ToastProvider,
    });

    act(() => {
      showToast({ tone: 'success', title: '옷을 삭제했어요' });
      showToast({ tone: 'info', title: '옷을 찾을 수 없어요' });
    });

    await vi.waitFor(() => {
      expect(result.current).toMatch(/\* 1\)$/);
    });
  });
});
