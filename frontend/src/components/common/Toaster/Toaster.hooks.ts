import { Toast } from '@base-ui/react/toast';
import { STACK_PEEK, VIEWPORT_GAP } from './Toaster.styled';

/*
 * 토스트가 화면 아래에서 차지하는 높이를 CSS 길이로 준다. 토스트가 없으면 null이다.
 * Toaster의 bottomOffset 위로 이만큼 덮이므로, 화면 아래에 붙은 요소는 이 위로 올려 피한다.
 */
export const useToastStackHeight = () => {
  const { toasts } = Toast.useToastManager();
  const visibleToasts = toasts.filter(
    (toast) => toast.transitionStatus !== 'ending' && toast.limited !== true,
  );
  const frontToast = visibleToasts[0];

  if (frontToast === undefined) {
    return null;
  }

  return `calc(${VIEWPORT_GAP} + ${frontToast.height ?? 0}px + ${STACK_PEEK} * ${visibleToasts.length - 1})`;
};
