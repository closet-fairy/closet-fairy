import styled from '@emotion/styled';
import { bg, fg, spacing, typography, zIndex } from '@/styles/tokens';

const SAFE_TOP = 'env(safe-area-inset-top, 0px)';
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';
const CARD_TOP = 58;
const CARD_BOTTOM_SPACE = 174;

// 카드 그림자가 잘리지 않도록 캐러셀을 카드보다 넓게 잡은 여백이다. 위아래가 달라야 화살표가 시안 높이에 온다.
const SLIDE_PADDING_TOP = 40;
const SLIDE_PADDING_BOTTOM = 24;
const SLIDE_PADDING_SIDE = 14;

export const ARROW_INSET = spacing[12];

export const Container = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100dvh;
  overflow: hidden;
  background-color: ${bg.floor};
`;

export const StatusPage = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: ${SAFE_BOTTOM};
`;

export const Counter = styled.p`
  position: absolute;
  top: calc(${spacing[20]} + ${SAFE_TOP});
  left: ${spacing[20]};
  z-index: ${zIndex.sticky};
  display: flex;
  align-items: baseline;
  gap: ${spacing[4]};
`;

export const CounterCurrent = styled.span`
  ${typography.title3}
  color: ${fg.neutral.strong};
`;

export const CounterTotal = styled.span`
  ${typography.body3}
  color: ${fg.neutral.soft};
`;

export const CloseButton = styled.div`
  position: absolute;
  top: calc(${spacing[8]} + ${SAFE_TOP});
  right: ${spacing[8]};
  z-index: ${zIndex.sticky};
  display: flex;
  color: ${fg.neutral.soft};
`;

export const CarouselArea = styled.div`
  flex: none;
  margin-top: calc(${CARD_TOP - SLIDE_PADDING_TOP}px + ${SAFE_TOP});
`;

export const Slide = styled.div`
  height: calc(
    100dvh -
      ${CARD_TOP + CARD_BOTTOM_SPACE - SLIDE_PADDING_TOP - SLIDE_PADDING_BOTTOM}px -
      ${SAFE_TOP} - ${SAFE_BOTTOM}
  );
  padding: ${SLIDE_PADDING_TOP}px ${SLIDE_PADDING_SIDE}px
    ${SLIDE_PADDING_BOTTOM}px;
`;
