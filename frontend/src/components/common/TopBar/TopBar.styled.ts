import styled from '@emotion/styled';
import {
  bg,
  fg,
  spacing,
  topBarHeight,
  typography,
  zIndex,
} from '@/styles/tokens';

export const Container = styled.header`
  position: sticky;
  top: 0;
  z-index: ${zIndex.sticky};
  flex: none;
  width: 100%;
  padding-top: env(safe-area-inset-top, 0px);
  background-color: ${bg.white};
`;

export const Inner = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[10]};
  height: ${topBarHeight}px;
  padding: 0 ${spacing[20]};
`;

export const Leading = styled.div`
  display: flex;
  flex: none;
  align-items: center;
`;

export const Title = styled.h1<{ $hasLeading: boolean }>`
  ${({ $hasLeading }) => ($hasLeading ? typography.title3 : typography.title2)}
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: ${fg.neutral.strong};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Trailing = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  margin-left: auto;
`;
