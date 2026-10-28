import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { BOTTOM_TAB_BAR_HEIGHT } from '@/components/BottomTabBar/BottomTabBar.styled';
import {
  bg,
  border,
  fg,
  radius,
  shadow,
  spacing,
  typography,
  zIndex,
} from '@/styles/tokens';

const FAB_SIZE = 56;
const EMPTY_VISUAL_SIZE = 88;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  background-color: ${bg.white};
`;

export const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing[14]} ${spacing[8]};
  padding: ${spacing[8]} ${spacing[20]} 0;
`;

export const GridItem = styled.li`
  min-width: 0;
`;

export const ListEnd = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[10]};
  min-height: ${spacing[40]};
  /* 마지막 줄이 FAB에 가리지 않게 FAB 높이만큼 더 띄운다. */
  padding: ${spacing[16]} ${spacing[20]} calc(${FAB_SIZE}px + ${spacing[32]});
`;

export const ListEndMessage = styled.p`
  ${typography.label1}
  color: ${fg.neutral.light};
`;

export const Spinner = styled.span`
  display: flex;
  color: ${fg.neutral.light};

  & > span {
    animation: ${spin} 1s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    & > span {
      animation: none;
    }
  }
`;

export const EmptyVisual = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${EMPTY_VISUAL_SIZE}px;
  height: ${EMPTY_VISUAL_SIZE}px;
  border: 1px dashed ${border.neutral.dashed};
  border-radius: ${radius.xl};
  background-color: ${bg.neutral.pale};
  color: ${fg.neutral.pale};
`;

export const Fab = styled.button`
  position: fixed;
  right: ${spacing[20]};
  bottom: calc(
    ${BOTTOM_TAB_BAR_HEIGHT}px + ${spacing[16]} +
      env(safe-area-inset-bottom, 0px)
  );
  z-index: ${zIndex.sticky};
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${FAB_SIZE}px;
  height: ${FAB_SIZE}px;
  border-radius: ${radius.full};
  background-color: ${bg.neutral.strong};
  box-shadow: ${shadow.lg};
  color: ${fg.white};

  &:focus-visible {
    outline: 2px solid ${border.neutral.strong};
    outline-offset: 2px;
  }
`;
