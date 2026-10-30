import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
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
  spacing,
  typography,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';
import type { SegmentedControlVariant } from './SegmentedControl';

const SEGMENT_HEIGHT = 40;
const MIN_TOUCH_SIZE = 44;

const CONTAINER_STYLE: Record<SegmentedControlVariant, SerializedStyles> = {
  grouped: css`
    gap: ${spacing[2]};
    padding: ${spacing[4]};
    border-radius: ${radius.md};
    background-color: ${bg.neutral.soft};
  `,
  separated: css`
    gap: ${spacing[8]};
  `,
};

const SEGMENT_STYLE: Record<SegmentedControlVariant, SerializedStyles> = {
  grouped: css`
    height: ${SEGMENT_HEIGHT}px;
    color: ${fg.neutral.light};

    &[data-pressed] {
      ${typography.body3Strong}
      background-color: ${bg.white};
      color: ${fg.neutral.strong};
      box-shadow: ${shadow.sm};
    }
  `,
  separated: css`
    height: ${MIN_TOUCH_SIZE}px;
    color: ${fg.neutral.default};
    box-shadow: inset 0 0 0 1px ${border.neutral.default};

    &[data-pressed] {
      ${typography.body3Strong}
      background-color: ${bg.neutral.strong};
      color: ${fg.white};
      box-shadow: none;
    }
  `,
};

export const Container = styled(ToggleGroup, transientOptions)<{
  $variant: SegmentedControlVariant;
}>`
  display: flex;
  width: 100%;

  ${({ $variant }) => CONTAINER_STYLE[$variant]}

  &[data-disabled] {
    opacity: ${opacity.disabled};
  }
`;

export const Segment = styled(Toggle, transientOptions)<{
  $variant: SegmentedControlVariant;
}>`
  ${typography.body3}
  position: relative;
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: ${spacing[4]};
  min-width: 0;
  border-radius: ${radius.sm};
  transition:
    background-color ${duration.fast} ${easing.standard},
    color ${duration.fast} ${easing.standard};

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    height: ${MIN_TOUCH_SIZE}px;
    transform: translateY(-50%);
  }

  ${({ $variant }) => SEGMENT_STYLE[$variant]}
`;

export const Label = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
