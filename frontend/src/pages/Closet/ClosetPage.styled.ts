import styled from '@emotion/styled';
import { BOTTOM_TAB_BAR_HEIGHT } from '@/components/BottomTabBar/BottomTabBar.styled';
import {
  appFrame,
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
import { visuallyHidden } from '@/styles/visuallyHidden';
import { GRID_COLUMN_COUNT } from './constants';

const FAB_SIZE = 56;
const FAB_PRESSED_SCALE = 0.94;
const EMPTY_VISUAL_SIZE = 88;

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  background-color: ${bg.white};
`;

export const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(${GRID_COLUMN_COUNT}, minmax(0, 1fr));
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
  /* 마지막 줄이 FAB에 가리지 않게 FAB 높이만큼 더 띄운다. */
  padding: ${spacing[16]} ${spacing[20]} calc(${FAB_SIZE}px + ${spacing[32]});
`;

export const ListEndMessage = styled.p`
  ${typography.label1}
  color: ${fg.neutral.light};
`;

export const LoadingMessage = styled.p`
  ${visuallyHidden}
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

// 토스트가 떠 있으면 앱 폭을 가로지르는 토스트에 가리지 않도록 그 위로 올라간다.
export const Fab = styled.button<{ $toastStackHeight: string | null }>`
  position: fixed;
  right: calc(${appFrame.sideInset} + ${spacing[20]});
  bottom: calc(
    ${BOTTOM_TAB_BAR_HEIGHT}px +
      ${({ $toastStackHeight }) =>
        $toastStackHeight === null
          ? spacing[16]
          : `${$toastStackHeight} + ${spacing[12]}`} +
      env(safe-area-inset-bottom, 0px)
  );
  transition:
    bottom ${duration.normal} ${easing.standard},
    transform ${duration.fast} ${easing.standard};
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

  &:active {
    transform: scale(${FAB_PRESSED_SCALE});
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
