import { css } from '@emotion/react';
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

// 편집기의 [원래대로] 칩과 같은 모양이다.
const CHIP_HEIGHT = 32;
const MIN_TOUCH_SIZE = 44;
const RING_WIDTH = 1.5;

export const Surface = styled.div<{
  $isActive: boolean;
  $isInteractive: boolean;
}>`
  position: absolute;
  inset: 0;
  overflow: hidden;
  ${({ $isActive }) =>
    $isActive &&
    css`
      touch-action: none;
      user-select: none;
      -webkit-touch-callout: none;
    `}
  ${({ $isInteractive }) =>
    $isInteractive &&
    css`
      cursor: none;
    `}
`;

export const Layer = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
`;

// 밝은 곳과 어두운 곳 어디서든 보이도록 어두운 선 안팎에 흰 선을 겹친다.
const ringStyles = css`
  position: absolute;
  top: 0;
  left: 0;
  border: ${RING_WIDTH}px solid ${border.neutral.strong};
  border-radius: ${radius.full};
  box-shadow:
    0 0 0 ${RING_WIDTH}px ${bg.white},
    inset 0 0 0 ${RING_WIDTH}px ${bg.white};
  pointer-events: none;
`;

export const CursorRing = styled.div`
  ${ringStyles}
`;

export const SizePreview = styled.div`
  ${ringStyles}
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

export const ZoomChip = styled.button`
  ${typography.label1Strong}
  position: absolute;
  top: ${spacing[12]};
  right: ${spacing[12]};
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]};
  height: ${CHIP_HEIGHT}px;
  padding: 0 ${spacing[12]};
  border-radius: ${radius.full};
  background-color: ${bg.white};
  box-shadow: ${shadow.sm};
  color: ${fg.neutral.default};
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    inset: ${-(MIN_TOUCH_SIZE - CHIP_HEIGHT) / 2}px 0;
  }

  &:disabled {
    opacity: ${opacity.disabled};
    cursor: default;
  }
`;

export const ChipIcon = styled.span`
  display: inline-flex;
  color: ${fg.neutral.soft};
`;
