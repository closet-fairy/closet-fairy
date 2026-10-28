import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import Toaster from '@/components/common/Toaster';
import { showToast, toastManager } from './toast';
import ToastProvider from './ToastProvider';

afterEach(() => {
  act(() => {
    toastManager.close();
  });
});

describe('구독 전에 띄운 토스트', () => {
  test('ToastProvider가 그려지기 전에 띄운 토스트도 그려진 뒤에 보여야 한다.', async () => {
    showToast({ tone: 'info', title: '옷을 찾을 수 없어요' });

    render(
      <ToastProvider>
        <Toaster />
      </ToastProvider>,
    );

    expect(
      await screen.findByRole('dialog', { name: '옷을 찾을 수 없어요' }),
    ).toBeInTheDocument();
  });

  test('처음 그려지는 순간 자식 effect에서 띄운 토스트도 보여야 한다.', async () => {
    const ShowOnMount = () => {
      useEffect(() => {
        showToast({ tone: 'success', title: '옷을 삭제했어요' });
      }, []);

      return null;
    };

    render(
      <ToastProvider>
        <ShowOnMount />
        <Toaster />
      </ToastProvider>,
    );

    expect(
      await screen.findByRole('dialog', { name: '옷을 삭제했어요' }),
    ).toBeInTheDocument();
  });
});
