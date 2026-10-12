import { css } from '@emotion/react';
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
  shadow,
} from '@/styles/tokens';
import type { IconButtonVariant } from './IconButton';

const MIN_TOUCH_SIZE = 44;
const CIRCLE_SIZE = 38;
const PRESSED_SCALE = 0.94;

const variantStyles: Record<IconButtonVariant, SerializedStyles> = {
  plain: css`
    background-color: transparent;
  `,
  circle: css`
    width: ${CIRCLE_SIZE}px;
    height: ${CIRCLE_SIZE}px;
    border: 1px solid ${border.neutral.default};
    border-radius: ${radius.full};
    background-color: ${bg.white};
    color: ${fg.neutral.strong};
    box-shadow: ${shadow.sm};
  `,
};

export const Button = styled.button<{ $variant: IconButtonVariant }>`
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  transition: transform ${duration.fast} ${easing.standard};

  ${({ $variant }) => variantStyles[$variant]}

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: max(100%, ${MIN_TOUCH_SIZE}px);
    height: max(100%, ${MIN_TOUCH_SIZE}px);
    transform: translate(-50%, -50%);
  }

  &:active:not(:disabled) {
    transform: scale(${PRESSED_SCALE});
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;
