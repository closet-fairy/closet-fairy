import styled from '@emotion/styled';
import { bg, duration, easing, radius, spacing } from '@/styles/tokens';

const DOT_SIZE = 4;
const ACTIVE_DOT_WIDTH = 16;

export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing[6]};
`;

export const Dot = styled.span<{ $isActive: boolean }>`
  flex: none;
  width: ${({ $isActive }) => ($isActive ? ACTIVE_DOT_WIDTH : DOT_SIZE)}px;
  height: ${DOT_SIZE}px;
  border-radius: ${radius.full};
  background-color: ${({ $isActive }) =>
    $isActive ? bg.neutral.strong : bg.neutral.default};
  transition:
    width ${duration.normal} ${easing.standard},
    background-color ${duration.normal} ${easing.standard};
`;
