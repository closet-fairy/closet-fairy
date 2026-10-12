import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import useInitialFocusByInteraction from '@/hooks/useInitialFocusByInteraction';
import useKeyboardScrollableRegion from '@/hooks/useKeyboardScrollableRegion';
import * as S from './Dialog.styled';

interface DialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  isDismissable?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  finalFocus?: RefObject<HTMLElement | null>;
}

const Dialog = (props: DialogProps) => {
  const {
    isOpen,
    onOpenChange,
    title,
    description,
    children,
    footer,
    isDismissable = true,
    initialFocus,
    finalFocus,
  } = props;
  const popupRef = useRef<HTMLDivElement>(null);
  const bodyRef = useKeyboardScrollableRegion();
  const getInitialFocus = useInitialFocusByInteraction(popupRef);

  const handleOpenChange = (
    nextIsOpen: boolean,
    eventDetails: BaseDialog.Root.ChangeEventDetails,
  ) => {
    if (!nextIsOpen && !isDismissable) {
      eventDetails.cancel();
      return;
    }

    onOpenChange(nextIsOpen);
  };

  return (
    <BaseDialog.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={!isDismissable}
    >
      <BaseDialog.Portal>
        <S.Backdrop forceRender />
        <S.Viewport>
          <S.Popup
            ref={popupRef}
            initialFocus={initialFocus ?? getInitialFocus}
            finalFocus={finalFocus}
          >
            <S.Title>{title}</S.Title>
            {description && <S.Description>{description}</S.Description>}
            {children && <S.Body ref={bodyRef}>{children}</S.Body>}
            {footer && <S.Footer>{footer}</S.Footer>}
          </S.Popup>
        </S.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
};

export default Dialog;
