import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { useRef, useSyncExternalStore } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { IconName } from '@/assets/icons';
import IconButton from '@/components/common/IconButton';
import useKeyboardScrollableRegion from '@/hooks/useKeyboardScrollableRegion';
import resolveInitialFocus from '@/utils/resolveInitialFocus';
import * as S from './FullScreenDialog.styled';

type FullScreenDialogCloseButton = 'back' | 'close';

interface FullScreenDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  closeButton?: FullScreenDialogCloseButton;
  initialFocus?: RefObject<HTMLElement | null>;
  finalFocus?: RefObject<HTMLElement | null>;
}

const CLOSE_BUTTON = {
  back: { icon: 'arrow_back', label: '뒤로 가기' },
  close: { icon: 'close', label: '닫기' },
} as const satisfies Record<
  FullScreenDialogCloseButton,
  { icon: IconName; label: string }
>;

/*
 * 안드로이드 Chrome은 가상 키보드가 떠도 레이아웃 높이를 줄이지 않아, 화면 아래쪽 목록이 키보드에 가린다.
 * 그래서 키보드를 뺀 실제 보이는 높이(visualViewport)에 다이얼로그 높이를 맞춘다.
 */
const subscribeVisualViewport = (onChange: () => void) => {
  const viewport = window.visualViewport;

  viewport?.addEventListener('resize', onChange);

  return () => {
    viewport?.removeEventListener('resize', onChange);
  };
};

// 핀치 줌으로 확대하면 height가 배율만큼 작아지므로, 배율을 곱해 레이아웃 기준 높이로 맞춘다.
const getVisualViewportHeight = () => {
  const viewport = window.visualViewport;

  return viewport ? viewport.height * viewport.scale : null;
};

const FullScreenDialog = (props: FullScreenDialogProps) => {
  const {
    isOpen,
    onOpenChange,
    title,
    children,
    header,
    footer,
    closeButton = 'back',
    initialFocus,
    finalFocus,
  } = props;
  const popupRef = useRef<HTMLDivElement>(null);
  const bodyRef = useKeyboardScrollableRegion();
  const visualViewportHeight = useSyncExternalStore(
    subscribeVisualViewport,
    getVisualViewportHeight,
  );
  const getInitialFocus = (openType: string) =>
    resolveInitialFocus(openType, popupRef.current);

  return (
    <BaseDialog.Root
      open={isOpen}
      onOpenChange={(nextIsOpen) => onOpenChange(nextIsOpen)}
      // 앱 폭보다 넓은 화면에서 양옆 바탕을 눌러도 입력 중인 화면이 닫히지 않게 한다.
      disablePointerDismissal
    >
      <BaseDialog.Portal>
        <S.Popup
          ref={popupRef}
          initialFocus={initialFocus ?? getInitialFocus}
          finalFocus={finalFocus}
          style={
            visualViewportHeight === null
              ? undefined
              : { height: visualViewportHeight }
          }
          // 바텀시트 안에서 열면 마우스로 끌 때 뒤의 시트가 끌려 닫히지 않게 한다.
          data-base-ui-swipe-ignore=""
        >
          <S.TopBar>
            <IconButton
              icon={CLOSE_BUTTON[closeButton].icon}
              aria-label={CLOSE_BUTTON[closeButton].label}
              onClick={() => onOpenChange(false)}
            />
            <S.Title>{title}</S.Title>
          </S.TopBar>
          {header && <S.Header>{header}</S.Header>}
          <S.Body ref={bodyRef}>{children}</S.Body>
          {footer && <S.Footer>{footer}</S.Footer>}
        </S.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
};

export default FullScreenDialog;
