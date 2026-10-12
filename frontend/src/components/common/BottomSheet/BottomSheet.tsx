import { Drawer } from '@base-ui/react/drawer';
import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import useInitialFocusByInteraction from '@/hooks/useInitialFocusByInteraction';
import useKeyboardScrollableRegion from '@/hooks/useKeyboardScrollableRegion';
import * as S from './BottomSheet.styled';

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  isDismissable?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  finalFocus?: RefObject<HTMLElement | null>;
}

const BottomSheet = (props: BottomSheetProps) => {
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
  const contentRef = useKeyboardScrollableRegion();
  const getInitialFocus = useInitialFocusByInteraction(popupRef);

  const handleOpenChange = (
    nextIsOpen: boolean,
    eventDetails: Drawer.Root.ChangeEventDetails,
  ) => {
    if (!nextIsOpen && !isDismissable) {
      eventDetails.cancel();
      return;
    }

    onOpenChange(nextIsOpen);
  };

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={!isDismissable}
    >
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <S.Backdrop forceRender />
          <S.Viewport>
            <S.Popup
              ref={popupRef}
              initialFocus={initialFocus ?? getInitialFocus}
              finalFocus={finalFocus}
              data-base-ui-swipe-ignore={isDismissable ? undefined : ''}
            >
              <S.Header>
                <S.Handle aria-hidden $isHidden={!isDismissable} />
                <S.Title>{title}</S.Title>
                {description && <S.Description>{description}</S.Description>}
              </S.Header>
              <S.Content ref={contentRef}>{children}</S.Content>
              {footer && <S.Footer>{footer}</S.Footer>}
            </S.Popup>
          </S.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
};

export default BottomSheet;
