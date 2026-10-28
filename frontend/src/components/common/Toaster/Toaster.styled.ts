import { Toast } from '@base-ui/react/toast';
import styled from '@emotion/styled';
import type { ToastTone } from '@/components/common/ToastProvider/toast';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  radius,
  shadow,
  spacing,
  typography,
  zIndex,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

// 뒤로 쌓인 토스트가 한 단계마다 위로 드러나는 높이와, 한쪽에서 좁아지는 폭이다.
const STACK_PEEK = spacing[8];
const STACK_INSET = spacing[6];
const EXPANDED_GAP = spacing[8];
// 아이콘을 제목 첫 줄(body3Strong, 14px × 1.5)의 가운데에 맞춘다.
const TITLE_LINE_HEIGHT = 21;

export const Viewport = styled(Toast.Viewport, transientOptions)<{
  $bottomOffset: number;
}>`
  position: fixed;
  right: ${spacing[16]};
  bottom: calc(
    ${({ $bottomOffset }) => $bottomOffset}px + ${spacing[12]} +
      env(safe-area-inset-bottom, 0px)
  );
  left: ${spacing[16]};
  z-index: ${zIndex.toast};
`;

export const Root = styled(Toast.Root, transientOptions)`
  --inset-x: calc(var(--toast-index) * ${STACK_INSET});
  --expanded-y: calc(
    var(--toast-offset-y) * -1 + var(--toast-index) * ${EXPANDED_GAP} * -1 +
      var(--toast-swipe-movement-y)
  );

  position: absolute;
  right: var(--inset-x);
  bottom: 0;
  left: var(--inset-x);
  z-index: calc(${zIndex.toast} - var(--toast-index));
  height: var(--toast-frontmost-height, var(--toast-height));
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.lg};
  background-color: ${bg.white};
  box-shadow: ${shadow.lg};
  user-select: none;
  transform: translateX(var(--toast-swipe-movement-x))
    translateY(
      calc(var(--toast-swipe-movement-y) - var(--toast-index) * ${STACK_PEEK})
    );
  transition:
    transform ${duration.slow} ${easing.standard},
    right ${duration.slow} ${easing.standard},
    left ${duration.slow} ${easing.standard},
    opacity ${duration.slow} ${easing.standard},
    height ${duration.fast} ${easing.standard};

  &[data-expanded] {
    right: 0;
    left: 0;
    height: var(--toast-height);
    transform: translateX(var(--toast-swipe-movement-x))
      translateY(var(--expanded-y));
  }

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: translateY(150%);
  }

  &[data-ending-style][data-swipe-direction='left'] {
    transform: translateX(calc(var(--toast-swipe-movement-x) - 150%));
  }

  &[data-ending-style][data-swipe-direction='right'] {
    transform: translateX(calc(var(--toast-swipe-movement-x) + 150%));
  }

  &[data-limited] {
    opacity: 0;
  }

  /* 펼친 토스트 사이 간격에서 마우스가 빠져나간 것으로 판정돼 접히지 않도록 간격만큼 판정 영역을 늘린다. */
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    height: calc(${EXPANDED_GAP} + 1px);
  }

  &:focus-visible {
    outline: 2px solid ${border.neutral.strong};
    outline-offset: -1px;
  }
`;

export const Content = styled(Toast.Content, transientOptions)`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[10]};
  padding: ${spacing[14]} ${spacing[16]};
  overflow: hidden;
  transition: opacity ${duration.normal} ${easing.standard};

  &[data-behind] {
    opacity: 0;
  }

  &[data-expanded] {
    opacity: 1;
  }
`;

export const IconWrapper = styled.span<{ $tone: ToastTone }>`
  display: flex;
  flex: none;
  align-items: center;
  height: ${TITLE_LINE_HEIGHT}px;
  color: ${({ $tone }) =>
    $tone === 'error' ? fg.error.default : fg.neutral.strong};
`;

export const Text = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[2]};
  min-width: 0;
`;

export const Title = styled(Toast.Title, transientOptions)`
  ${typography.body3Strong}
  margin: 0;
  color: ${fg.neutral.strong};
`;

export const Description = styled(Toast.Description, transientOptions)`
  ${typography.label1}
  margin: 0;
  color: ${fg.neutral.soft};
`;
