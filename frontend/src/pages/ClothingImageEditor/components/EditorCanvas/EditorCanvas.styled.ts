import { css } from '@emotion/react';
import styled from '@emotion/styled';

export const Canvas = styled.canvas<{ $isScaled: boolean }>`
  display: block;
  flex: none;
  ${({ $isScaled }) =>
    !$isScaled &&
    css`
      width: 100%;
      height: 100%;
      object-fit: contain;
    `}
`;
