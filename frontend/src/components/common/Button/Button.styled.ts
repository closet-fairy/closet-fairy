import { css, keyframes } from '@emotion/react';
import type { SerializedStyles } from '@emotion/react';
import styled from '@emotion/styled';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  opacity,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';
import type { ButtonSize, ButtonVariant } from './Button';

const PRESSED_SCALE = 0.98;

const SPIN_DURATION = '1s';

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const HEIGHT: Record<ButtonSize, number> = {
  lg: 54,
  md: 48,
  sm: 40,
};

const sizeStyles: Record<ButtonSize, SerializedStyles> = {
  lg: css`
    min-height: ${HEIGHT.lg}px;
    padding: ${spacing[8]} ${spacing[20]};
    gap: ${spacing[6]};
    border-radius: ${radius.md};
  `,
  md: css`
    min-height: ${HEIGHT.md}px;
    padding: ${spacing[8]} ${spacing[16]};
    gap: ${spacing[6]};
    border-radius: ${radius.md};
  `,
  sm: css`
    min-height: ${HEIGHT.sm}px;
    padding: ${spacing[6]} ${spacing[12]};
    gap: ${spacing[4]};
    border-radius: ${radius.sm};
  `,
};

const strongTextStyles: Record<ButtonSize, SerializedStyles> = {
  lg: typography.body1Strong,
  md: typography.body2Strong,
  sm: typography.label1Strong,
};

const regularTextStyles: Record<ButtonSize, SerializedStyles> = {
  lg: typography.body1,
  md: typography.body2,
  sm: typography.label1,
};

const variantStyles: Record<ButtonVariant, SerializedStyles> = {
  primary: css`
    background-color: ${bg.neutral.strong};
    color: ${fg.white};
  `,
  outline: css`
    background-color: ${bg.white};
    color: ${fg.neutral.strong};
    box-shadow: inset 0 0 0 1px ${border.neutral.default};
  `,
  text: css`
    background-color: transparent;
    color: ${fg.neutral.light};
  `,
  danger: css`
    background-color: ${bg.white};
    color: ${fg.error.default};
    box-shadow: inset 0 0 0 1px ${border.error.default};
  `,
};

export const Button = styled.button<{
  $variant: ButtonVariant;
  $size: ButtonSize;
  $isFullWidth: boolean;
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ $isFullWidth }) => ($isFullWidth ? '100%' : 'auto')};
  text-align: center;
  transition: transform ${duration.fast} ${easing.standard};

  ${({ $size }) => sizeStyles[$size]}
  ${({ $variant, $size }) =>
    $variant === 'text' ? regularTextStyles[$size] : strongTextStyles[$size]}
  ${({ $variant }) => variantStyles[$variant]}

  &:active:not(:disabled, [aria-busy='true']) {
    transform: scale(${PRESSED_SCALE});
  }

  &[aria-busy='true'] {
    cursor: progress;
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;

export const Content = styled.span<{ $isHidden: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: inherit;
  min-width: 0;
  opacity: ${({ $isHidden }) => ($isHidden ? 0 : 1)};
`;

export const Label = styled.span`
  min-width: 0;
`;

export const Spinner = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const SpinnerIcon = styled.span`
  display: inline-flex;
  animation: ${spin} ${SPIN_DURATION} linear infinite;
`;
