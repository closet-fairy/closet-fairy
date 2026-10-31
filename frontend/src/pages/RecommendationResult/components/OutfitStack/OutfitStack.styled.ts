import styled from '@emotion/styled';
import { bg, duration, easing, radius, shadow, spacing } from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

const STRIP_HEIGHT = 60;
const TOUCH_TARGET_SIZE = 44;

// 카드를 세로로 끌어야 하므로, 브라우저가 스크롤이나 당겨서 새로고침으로 가져가지 않게 한다.
export const Stack = styled.div`
  position: relative;
  height: 100%;
  touch-action: pinch-zoom;
  user-select: none;
`;

export const Strip = styled.div`
  position: absolute;
  top: calc(${spacing[14]} * -1);
  right: ${spacing[16]};
  left: ${spacing[16]};
  height: ${STRIP_HEIGHT}px;
  border-radius: ${radius.lg};
  background-color: ${bg.card.stacked};
  box-shadow: ${shadow.md};
`;

export const Layer = styled.div<{ $isHidden: boolean; $isSettling: boolean }>`
  position: absolute;
  inset: 0;
  visibility: ${({ $isHidden }) => ($isHidden ? 'hidden' : 'visible')};
  transition: ${({ $isSettling }) =>
    $isSettling ? `transform ${duration.slow} ${easing.standard}` : 'none'};
`;

export const HistoryButton = styled.div`
  position: absolute;
  top: ${spacing[14]};
  right: ${spacing[14]};

  & > button {
    min-height: ${TOUCH_TARGET_SIZE}px;
  }

  &:not(:focus-within) {
    ${visuallyHidden}
  }
`;
