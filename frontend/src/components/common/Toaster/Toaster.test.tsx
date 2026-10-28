import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import ToastProvider from '@/components/common/ToastProvider';
import {
  showToast,
  toastManager,
} from '@/components/common/ToastProvider/ToastProvider.toast';
import Toaster from './Toaster';

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
