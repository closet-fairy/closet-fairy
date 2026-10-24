import { Slider } from '@base-ui/react/slider';
import styled from '@emotion/styled';
import {
  bg,
  border,
  fg,
  opacity,
  radius,
  shadow,
  spacing,
  typography,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

const MIN_TOUCH_SIZE = 44;
const TRACK_HEIGHT = 4;
const THUMB_SIZE = 22;
const TICK_WIDTH = 2;
const TICK_HEIGHT = 14;

export const Root = styled(Slider.Root, transientOptions)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
  width: 100%;
  padding: 0 ${THUMB_SIZE / 2}px;

  &[data-disabled] {
    opacity: ${opacity.disabled};
  }
`;

export const Control = styled(Slider.Control, transientOptions)`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${MIN_TOUCH_SIZE}px;
  touch-action: none;
  cursor: pointer;

  [data-disabled] > & {
    cursor: default;
  }
`;

export const Track = styled(Slider.Track, transientOptions)`
  position: relative;
  width: 100%;
  height: ${TRACK_HEIGHT}px;
  border-radius: ${radius.full};
  background-color: ${bg.neutral.default};
`;

export const Fill = styled.span`
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: ${radius.full};
  background-color: ${bg.neutral.strong};
`;

export const Tick = styled.span`
  position: absolute;
  top: 50%;
  width: ${TICK_WIDTH}px;
  height: ${TICK_HEIGHT}px;
  border-radius: ${radius.full};
  background-color: ${fg.neutral.pale};
  transform: translate(-50%, -50%);
`;

export const Thumb = styled(Slider.Thumb, transientOptions)`
  width: ${THUMB_SIZE}px;
  height: ${THUMB_SIZE}px;
  border: 1.5px solid ${border.neutral.strong};
  border-radius: ${radius.full};
  background-color: ${bg.white};
  box-shadow: ${shadow.md};

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${MIN_TOUCH_SIZE}px;
    height: ${MIN_TOUCH_SIZE}px;
    transform: translate(-50%, -50%);
  }

  &:has(:focus-visible) {
    outline: 2px solid ${border.neutral.strong};
    outline-offset: 2px;
  }
`;

export const MarkLabels = styled.div`
  position: relative;
  height: 1lh;
  ${typography.caption2}
  color: ${fg.neutral.pale};
`;

export const MarkLabel = styled.span`
  position: absolute;
  top: 0;
  white-space: nowrap;
`;
