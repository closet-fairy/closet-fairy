import { css } from '@emotion/react';

const textStyle = (
  fontSize: number,
  lineHeight: number,
  fontWeight: 400 | 500 | 600,
) => css`
  font-size: ${fontSize}px;
  line-height: ${lineHeight};
  font-weight: ${fontWeight};
`;

export const typography = {
  title1: textStyle(21, 1.4, 600),
  title2: textStyle(18, 1.4, 600),
  title3: textStyle(17, 1.4, 600),

  body1: textStyle(16, 1.5, 400),
  body1Medium: textStyle(16, 1.5, 500),
  body1Strong: textStyle(16, 1.5, 600),
  body2: textStyle(15, 1.5, 400),
  body2Strong: textStyle(15, 1.5, 600),
  body3: textStyle(14, 1.5, 400),
  body3Strong: textStyle(14, 1.5, 600),

  label1: textStyle(13, 1.5, 400),
  label1Strong: textStyle(13, 1.5, 600),

  caption1: textStyle(12, 1.4, 400),
  caption1Strong: textStyle(12, 1.4, 600),
  caption2: textStyle(11, 1.3, 400),
  caption2Strong: textStyle(11, 1.3, 600),
} as const;
