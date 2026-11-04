import styled from '@emotion/styled';
import { FLOOR_CARD } from '@/domains/recommendation/floorLayout.constants';
import { OUTFIT_PAGER } from '@/pages/RecommendationResult/hooks/useOutfitPager.constants';
import {
  appFrame,
  bg,
  blur,
  border,
  radius,
  shadow,
  spacing,
} from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

const TOUCH_TARGET_SIZE = 44;
const ORDER_BADGE_TOP = -36;
const OVERLAY_Z_INDEX = 200;

// 카드를 세로로 끌어야 하므로, 브라우저가 스크롤이나 당겨서 새로고침으로 가져가지 않게 한다.
export const Stack = styled.div`
  position: relative;
  isolation: isolate;
  height: 100%;
  touch-action: pinch-zoom;
  user-select: none;
  container-type: size;
`;

// 카드는 옷 배치와 같은 크기로, 끌기 영역의 위에 붙여 가운데에 둔다.
export const Frame = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  width: min(
    100cqw,
    calc(100cqh * ${FLOOR_CARD.width} / ${FLOOR_CARD.height}),
    ${appFrame.maxWidth}
  );
  aspect-ratio: ${FLOOR_CARD.width} / ${FLOOR_CARD.height};
  margin: 0 auto;
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
    calc((1 - var(--card-presence, 0)) * ${-OUTFIT_PAGER.ORDER_BADGE_RISE_PX}px)
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
  pointer-events: none;

  [data-revealed] & {
    backdrop-filter: blur(${blur.card});
  }
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
