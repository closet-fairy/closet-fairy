import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, border, fg, opacity, shadow, spacing } from '@/styles/tokens';
import { MAGNIFIER_SIZE } from './magnifier';
import { GRAB_RADIUS } from './moveCorner';

const HANDLE_SIZE = 14;
const HANDLE_BORDER_WIDTH = 2;
const EDGE_WIDTH = 1.5;
const EDGE_SHADOW_WIDTH = 3;
const MAGNIFIER_BORDER_WIDTH = 3;
const CROSSHAIR_WIDTH = 1.5;
const CROSSHAIR_INSET = 14;
const CHECKER_SIZE = 16;

// 사진 귀퉁이의 꼭짓점도 잡는 반지름 전체로 잡을 수 있게, 잡는 영역을 상자 밖으로 넓힌다.
export const Root = styled.div<{ $isDisabled: boolean }>`
  position: absolute;
  inset: -${GRAB_RADIUS}px;
  touch-action: none;
  ${({ $isDisabled }) =>
    $isDisabled &&
    css`
      pointer-events: none;
    `}
`;

export const Box = styled.div`
  position: absolute;
  inset: ${GRAB_RADIUS}px;
  pointer-events: none;
`;

// 시안처럼 사각형 바깥은 그림 밖 스테이지까지 덮으므로 SVG가 상자 밖으로 넘쳐 그린다.
export const Shapes = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
`;

export const Dim = styled.path`
  fill: ${bg.dim};
  fill-rule: evenodd;
`;

export const EdgeShadow = styled.polygon`
  fill: none;
  stroke: ${bg.dim};
  stroke-width: ${EDGE_SHADOW_WIDTH}px;
  stroke-linejoin: round;
`;

export const Edge = styled.polygon`
  fill: none;
  stroke: ${fg.white};
  stroke-width: ${EDGE_WIDTH}px;
  stroke-linejoin: round;
`;

export const Handle = styled.span<{ $isDisabled: boolean }>`
  position: absolute;
  width: ${HANDLE_SIZE}px;
  height: ${HANDLE_SIZE}px;
  border: ${HANDLE_BORDER_WIDTH}px solid ${border.neutral.strong};
  border-radius: 50%;
  background-color: ${bg.white};
  box-shadow: ${shadow.md};
  transform: translate(-50%, -50%);
  pointer-events: none;
  ${({ $isDisabled }) =>
    $isDisabled &&
    css`
      opacity: ${opacity.disabled};
    `}
`;

export const Magnifier = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute;
  ${({ $side }) =>
    $side === 'left'
      ? css`
          left: ${spacing[12]};
        `
      : css`
          right: ${spacing[12]};
        `}
  width: ${MAGNIFIER_SIZE}px;
  height: ${MAGNIFIER_SIZE}px;
  overflow: hidden;
  border-radius: 50%;
  background-color: ${bg.white};
  background-image: repeating-conic-gradient(
    ${bg.neutral.soft} 0% 25%,
    ${bg.white} 0% 50%
  );
  background-size: ${CHECKER_SIZE}px ${CHECKER_SIZE}px;
  box-shadow:
    0 0 0 ${MAGNIFIER_BORDER_WIDTH}px ${bg.white},
    ${shadow.lg};
  pointer-events: none;
`;

export const MagnifierCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

export const MagnifierShapes = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

const crosshairLine = css`
  position: absolute;
  background-color: ${bg.neutral.strong};
`;

export const CrosshairHorizontal = styled.span`
  ${crosshairLine}
  top: calc(50% - ${CROSSHAIR_WIDTH / 2}px);
  right: ${CROSSHAIR_INSET}px;
  left: ${CROSSHAIR_INSET}px;
  height: ${CROSSHAIR_WIDTH}px;
`;

export const CrosshairVertical = styled.span`
  ${crosshairLine}
  top: ${CROSSHAIR_INSET}px;
  bottom: ${CROSSHAIR_INSET}px;
  left: calc(50% - ${CROSSHAIR_WIDTH / 2}px);
  width: ${CROSSHAIR_WIDTH}px;
`;
