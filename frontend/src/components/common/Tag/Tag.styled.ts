import { css } from '@emotion/react';
import type { SerializedStyles } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';
import type { TagSize, TagVariant } from './Tag';

const sizeStyles: Record<TagSize, SerializedStyles> = {
  xs: css`
    ${typography.caption2Strong}
    gap: ${spacing[2]};
    padding: ${spacing[2]} ${spacing[6]};
    border-radius: ${radius.xs};
  `,
  sm: css`
    ${typography.caption1Strong}
    gap: ${spacing[4]};
    padding: ${spacing[4]} ${spacing[10]};
    border-radius: ${radius.full};
  `,
  md: css`
    ${typography.label1Strong}
    gap: ${spacing[6]};
    padding: ${spacing[4]} ${spacing[12]};
    border-radius: ${radius.full};
  `,
};

const variantStyles: Record<TagVariant, SerializedStyles> = {
  neutral: css`
    background-color: ${bg.neutral.soft};
    color: ${fg.neutral.default};
  `,
  inverse: css`
    background-color: ${bg.neutral.strong};
    color: ${fg.white};
  `,
  outline: css`
    background-color: transparent;
    color: ${fg.neutral.strong};
    box-shadow: inset 0 0 0 1px ${border.neutral.strong};
  `,
  white: css`
    background-color: ${bg.white};
    color: ${fg.neutral.default};
    box-shadow: inset 0 0 0 1px ${border.neutral.default};
  `,
};

export const Container = styled.span<{ $variant: TagVariant; $size: TagSize }>`
  display: inline-flex;
  align-items: center;
  max-width: 100%;

  ${({ $size }) => sizeStyles[$size]}
  ${({ $variant }) => variantStyles[$variant]}
`;

export const Label = styled.span`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
