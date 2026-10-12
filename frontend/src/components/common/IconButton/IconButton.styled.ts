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
    color: ${fg.neutral.strong};

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      z-index: -1;
      width: ${CIRCLE_SIZE}px;
      height: ${CIRCLE_SIZE}px;
      border: 1px solid ${border.neutral.default};
      border-radius: ${radius.full};
      background-color: ${bg.white};
      box-shadow: ${shadow.sm};
      transform: translate(-50%, -50%);
    }
  `,
};

export const Button = styled.button<{ $variant: IconButtonVariant }>`
  position: relative;
  isolation: isolate;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: ${MIN_TOUCH_SIZE}px;
  min-height: ${MIN_TOUCH_SIZE}px;
  border-radius: ${radius.full};
  transition: transform ${duration.fast} ${easing.standard};

  ${({ $variant }) => variantStyles[$variant]}

  &:active:not(:disabled) {
    transform: scale(${PRESSED_SCALE});
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;
