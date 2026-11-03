import styled from '@emotion/styled';
import { bg, blur, border, radius, shadow, spacing } from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

const TOUCH_TARGET_SIZE = 44;
const ORDER_BADGE_TOP = -36;
const ORDER_BADGE_RISE = 8;
const OVERLAY_Z_INDEX = 200;

// 카드를 세로로 끌어야 하므로, 브라우저가 스크롤이나 당겨서 새로고침으로 가져가지 않게 한다.
export const Stack = styled.div`
  position: relative;
  height: 100%;
  touch-action: pinch-zoom;
  user-select: none;
`;

export const OrderBadge = styled.div`
  position: absolute;
  top: ${ORDER_BADGE_TOP}px;
  left: 50%;
  z-index: ${OVERLAY_Z_INDEX};
  display: flex;
  opacity: var(--card-presence, 0);
  transform: translate(
    -50%,
    calc((1 - var(--card-presence, 0)) * ${-ORDER_BADGE_RISE}px)
  );
  pointer-events: none;
`;

export const Layer = styled.div`
  position: absolute;
  inset: 0;
`;

export const Surface = styled.div`
  position: absolute;
  inset: 0;
  border-radius: ${radius.lg};
  background-color: color-mix(
    in srgb,
    ${bg.card.floatingFar} calc(var(--surface-distance, 0) * 100%),
    ${bg.card.floating}
  );
  box-shadow:
    ${shadow.card},
    inset 0 0 0 1px ${border.neutral.default};
  opacity: var(--surface-opacity, 0);
  backdrop-filter: blur(${blur.card});
  pointer-events: none;
`;

export const Content = styled.div`
  position: absolute;
  inset: 0;
  opacity: var(--content-opacity, 1);
`;

export const HistoryButton = styled.div`
  position: absolute;
  top: ${spacing[14]};
  right: ${spacing[14]};
  z-index: ${OVERLAY_Z_INDEX};

  & > button {
    min-height: ${TOUCH_TARGET_SIZE}px;
  }

  &:not(:focus-within) {
    ${visuallyHidden}
  }
`;
