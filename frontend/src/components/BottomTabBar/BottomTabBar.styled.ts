import styled from '@emotion/styled';
import { createLink } from '@tanstack/react-router';
import { bg, border, fg, spacing, typography, zIndex } from '@/styles/tokens';

const BAR_HEIGHT = 66;

export const Container = styled.nav`
  position: sticky;
  bottom: 0;
  z-index: ${zIndex.sticky};
  flex: none;
  width: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid ${border.neutral.default};
  background-color: ${bg.white};
`;

export const List = styled.ul`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: ${BAR_HEIGHT}px;
`;

export const Item = styled.li`
  display: flex;
`;

const TabAnchor = styled.a`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[4]};
  align-items: center;
  justify-content: center;
  color: ${fg.neutral.light};

  &[aria-current='page'] {
    color: ${fg.neutral.strong};
  }
`;

export const TabLink = createLink(TabAnchor);

export const Label = styled.span<{ $isActive: boolean }>`
  ${({ $isActive }) =>
    $isActive ? typography.caption2Strong : typography.caption2}
`;
