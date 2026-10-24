import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import styled from '@emotion/styled';
import {
  bg,
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

const SEGMENT_HEIGHT = 40;
const MIN_TOUCH_SIZE = 44;

export const Container = styled(ToggleGroup, transientOptions)`
  display: flex;
  gap: ${spacing[2]};
  width: 100%;
  padding: ${spacing[4]};
  border-radius: ${radius.md};
  background-color: ${bg.neutral.soft};

  &[data-disabled] {
    opacity: ${opacity.disabled};
  }
`;

export const Segment = styled(Toggle, transientOptions)`
  ${typography.body3}
  position: relative;
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: ${spacing[4]};
  min-width: 0;
  height: ${SEGMENT_HEIGHT}px;
  border-radius: ${radius.sm};
  color: ${fg.neutral.light};
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

  &[data-pressed] {
    ${typography.body3Strong}
    background-color: ${bg.white};
    color: ${fg.neutral.strong};
    box-shadow: ${shadow.sm};
  }
`;

export const Label = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
