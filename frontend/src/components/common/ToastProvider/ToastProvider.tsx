import { Toast } from '@base-ui/react/toast';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  markToastReady,
  TOAST_LIMIT,
  toastManager,
} from './ToastProvider.toast';

interface ToastProviderProps {
  children: ReactNode;
}

const ToastProvider = (props: ToastProviderProps) => {
  const { children } = props;

  // 자식인 Toast.Provider가 관리자를 구독한 뒤에 돈다. 그때까지 쌓인 토스트를 이어서 띄운다.
  useEffect(() => markToastReady(), []);

  return (
    <Toast.Provider toastManager={toastManager} limit={TOAST_LIMIT}>
      {children}
    </Toast.Provider>
  );
};

export default ToastProvider;
