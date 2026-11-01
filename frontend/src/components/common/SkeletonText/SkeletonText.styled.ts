import type { SerializedStyles } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, radius } from '@/styles/tokens';

const BAR_HEIGHT = '0.92em';

export const Line = styled.div<{ $textStyle: SerializedStyles }>`
  ${({ $textStyle }) => $textStyle}
  display: flex;
  align-items: center;
  width: 100%;

  &::before {
    content: '\\200b';
  }
`;

export const Bar = styled.span<{ $width: string }>`
  flex: none;
  width: ${({ $width }) => $width};
  height: ${BAR_HEIGHT};
  border-radius: ${radius.xs};
  background-color: ${bg.neutral.soft};
`;
