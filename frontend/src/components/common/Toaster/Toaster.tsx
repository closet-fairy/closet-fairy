import { Toast } from '@base-ui/react/toast';
import { useSyncExternalStore } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import type { ToastTone } from '@/components/common/ToastProvider/ToastProvider.toast';
import {
  getToastBottomOffset,
  isToastTone,
  subscribeToastBottomOffset,
} from '@/components/common/ToastProvider/ToastProvider.toast';
import * as S from './Toaster.styled';

interface ToasterProps {
  bottomOffset?: number;
}

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'check_circle-fill',
  info: 'info-fill',
  error: 'error-fill',
};

const Toaster = (props: ToasterProps) => {
  const { bottomOffset = 0 } = props;
  const { toasts } = Toast.useToastManager();
  const bottomOffsetOverride = useSyncExternalStore(
    subscribeToastBottomOffset,
    getToastBottomOffset,
  );

  return (
    <Toast.Portal>
      <S.Viewport
        aria-label="알림"
        $bottomOffset={bottomOffsetOverride ?? bottomOffset}
      >
        {toasts.map((toast) => {
          const tone = isToastTone(toast.type) ? toast.type : 'info';

          return (
            <S.Root
              key={toast.id}
              toast={toast}
              swipeDirection={['down', 'left', 'right']}
            >
              <S.Content>
                <S.IconWrapper $tone={tone}>
                  <Icon name={TONE_ICON[tone]} size="md" />
                </S.IconWrapper>
                <S.Text>
                  <S.Title />
                  {toast.description && <S.Description />}
                </S.Text>
              </S.Content>
            </S.Root>
          );
        })}
      </S.Viewport>
    </Toast.Portal>
  );
};

export default Toaster;
