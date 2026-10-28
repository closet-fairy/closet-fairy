import { Toast } from '@base-ui/react/toast';

export type ToastTone = 'success' | 'info' | 'error';

interface ShowToastOptions {
  tone: ToastTone;
  title: string;
  description?: string;
  id?: string;
  timeout?: number;
}

export const TOAST_LIMIT = 3;

// 컴포넌트 밖(요청 콜백 등)에서도 토스트를 띄울 수 있게 앱 전체가 관리자 하나를 공유한다.
export const toastManager = Toast.createToastManager();

/*
 * 관리자는 구독자가 없을 때 들어온 토스트를 버린다. Provider는 effect에서 구독하므로,
 * 앱이 처음 그려지는 순간 자식 effect에서 띄운 토스트를 잃지 않도록 구독 전에는 쌓아 둔다.
 */
let isReady = false;
const pendingToasts: ShowToastOptions[] = [];

const addToast = (options: ShowToastOptions) => {
  const { tone, title, description, id, timeout } = options;

  toastManager.add({
    id,
    type: tone,
    title,
    description,
    timeout,
    priority: tone === 'error' ? 'high' : 'low',
  });
};

export const showToast = (options: ShowToastOptions) => {
  if (!isReady) {
    pendingToasts.push(options);
    return;
  }

  addToast(options);
};

export const markToastReady = () => {
  isReady = true;
  pendingToasts.splice(0).forEach(addToast);

  return () => {
    isReady = false;
  };
};

export const isToastTone = (type: string | undefined): type is ToastTone =>
  type === 'success' || type === 'info' || type === 'error';
