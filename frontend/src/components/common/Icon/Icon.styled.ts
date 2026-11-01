import styled from '@emotion/styled';
import { ICON_SIZE } from './Icon.constants';
import type { IconSize } from './Icon';

export const Container = styled.span<{ $size: IconSize }>`
  display: inline-flex;
  flex: none;
  vertical-align: middle;
  width: ${({ $size }) => ICON_SIZE[$size]}px;
  height: ${({ $size }) => ICON_SIZE[$size]}px;

  & > svg {
    width: 100%;
    height: 100%;
  }
`;
