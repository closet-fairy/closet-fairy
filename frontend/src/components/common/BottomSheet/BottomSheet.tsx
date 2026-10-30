import { Drawer } from '@base-ui/react/drawer';
import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import useKeyboardScrollableRegion from '@/hooks/useKeyboardScrollableRegion';
import resolveInitialFocus from '@/utils/resolveInitialFocus';
import * as S from './BottomSheet.styled';

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  isTitleHidden?: boolean;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  isDismissable?: boolean;
  maxHeight?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  finalFocus?: RefObject<HTMLElement | null>;
}

const BottomSheet = (props: BottomSheetProps) => {
  const {
    isOpen,
    onOpenChange,
    title,
    isTitleHidden = false,
    description,
    children,
    footer,
    isDismissable = true,
    maxHeight,
    initialFocus,
    finalFocus,
  } = props;
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useKeyboardScrollableRegion();
  const getInitialFocus = (openType: string) =>
    resolveInitialFocus(openType, popupRef.current);

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
              $maxHeight={maxHeight}
              initialFocus={initialFocus ?? getInitialFocus}
              finalFocus={finalFocus}
              data-base-ui-swipe-ignore={isDismissable ? undefined : ''}
            >
              <S.Header>
                <S.Handle
                  aria-hidden
                  $isHidden={!isDismissable}
                  $isTitleHidden={isTitleHidden}
                />
                <S.Title $isHidden={isTitleHidden}>{title}</S.Title>
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
