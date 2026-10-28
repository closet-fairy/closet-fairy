import styled from '@emotion/styled';
import { createLink } from '@tanstack/react-router';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  spacing,
  typography,
  zIndex,
} from '@/styles/tokens';

const BAR_HEIGHT = 66;
const BORDER_WIDTH = 1;
const PRESSED_SCALE = 0.94;

// 위쪽 테두리까지 더한, 화면 아래에서 탭 바가 차지하는 높이다. 아래쪽 안전 영역은 뺀 값이다.
export const BOTTOM_TAB_BAR_HEIGHT = BAR_HEIGHT + BORDER_WIDTH;

export const Container = styled.nav`
  position: sticky;
  bottom: 0;
  z-index: ${zIndex.sticky};
  flex: none;
  width: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: ${BORDER_WIDTH}px solid ${border.neutral.default};
  background-color: ${bg.white};
`;

export const List = styled.ul`
  display: flex;
  height: ${BAR_HEIGHT}px;
`;

export const Item = styled.li`
  display: flex;
  flex: 1;
`;

const TabAnchor = styled.a`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[4]};
  align-items: center;
  justify-content: center;
  color: ${fg.neutral.light};
  transition:
    color ${duration.fast} ${easing.standard},
    transform ${duration.fast} ${easing.standard};

  &[aria-current='page'] {
    color: ${fg.neutral.strong};
  }

  &:active {
    transform: scale(${PRESSED_SCALE});
  }
`;

export const TabLink = createLink(TabAnchor);

export const Label = styled.span<{ $isActive: boolean }>`
  ${({ $isActive }) =>
    $isActive ? typography.caption2Strong : typography.caption2}
`;
