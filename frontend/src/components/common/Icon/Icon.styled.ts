import styled from '@emotion/styled';
import type { IconSize } from './Icon';

const ICON_SIZE: Record<IconSize, number> = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 36,
};

export const Container = styled.span<{ $size: IconSize }>`
  display: inline-flex;
  flex: none;
  width: ${({ $size }) => ICON_SIZE[$size]}px;
  height: ${({ $size }) => ICON_SIZE[$size]}px;

  & > svg {
    width: 100%;
    height: 100%;
  }
`;
