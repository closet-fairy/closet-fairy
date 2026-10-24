import { keyframes } from '@emotion/react';
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

const CHECKER_SIZE = 16;
const CHIP_HEIGHT = 32;
// 그림은 [원래대로] 칩 줄 아래에서 시작한다. 원근 돋보기도 이 높이에 맞춰 띄운다.
export const VIEWPORT_TOP =
  parseFloat(spacing[12]) + CHIP_HEIGHT + parseFloat(spacing[8]);
const MIN_TOUCH_SIZE = 44;
const GRID_DIVISIONS = 6;
// 브러시·원근·회전 패널의 높이를 비슷하게 맞춰, 단계를 오갈 때 캔버스 크기가 덜 흔들리게 한다.
const PANEL_MIN_HEIGHT = 102;
// 회전 표시는 모션 토큰(최대 300ms)으로는 너무 빨라 따로 둔다.
const SPIN_DURATION = '1s';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background-color: ${bg.white};
`;

export const Saving = styled.div`
  ${typography.body3Strong}
  display: inline-flex;
  align-items: center;
  gap: ${spacing[6]};
  padding: 0 ${spacing[4]};
  color: ${fg.neutral.soft};
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Spinner = styled.span`
  display: inline-flex;
  animation: ${spin} ${SPIN_DURATION} linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const StepBand = styled.div`
  flex: none;
  padding: ${spacing[6]} ${spacing[12]};
  border-top: 1px solid ${border.neutral.soft};
  border-bottom: 1px solid ${border.neutral.soft};
  background-color: ${bg.white};
`;

export const Stage = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: ${bg.white};
  background-image: repeating-conic-gradient(
    ${bg.neutral.soft} 0% 25%,
    ${bg.white} 0% 50%
  );
  background-size: ${CHECKER_SIZE}px ${CHECKER_SIZE}px;
`;

export const Viewport = styled.div`
  position: absolute;
  inset: ${spacing[16]};
  top: ${VIEWPORT_TOP}px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// 원근 오버레이가 캔버스와 같은 크기·자리에 겹치도록 캔버스를 감싼다.
export const CanvasBox = styled.div`
  position: relative;
  display: flex;
  flex: none;
`;

export const StageMessage = styled.p`
  ${typography.body3}
  color: ${fg.neutral.soft};
  text-align: center;
`;

export const Grid = styled.div`
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, ${border.neutral.dashed} 1px, transparent 1px),
    linear-gradient(to bottom, ${border.neutral.dashed} 1px, transparent 1px);
  background-position: center;
  background-size: calc(100% / ${GRID_DIVISIONS}) calc(100% / ${GRID_DIVISIONS});
  pointer-events: none;
`;

export const ResetChip = styled.button`
  ${typography.label1Strong}
  position: absolute;
  top: ${spacing[12]};
  left: ${spacing[12]};
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]};
  height: ${CHIP_HEIGHT}px;
  padding: 0 ${spacing[12]};
  border-radius: ${radius.full};
  background-color: ${bg.white};
  box-shadow: ${shadow.sm};
  color: ${fg.neutral.default};

  &::before {
    content: '';
    position: absolute;
    inset: ${-(MIN_TOUCH_SIZE - CHIP_HEIGHT) / 2}px 0;
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;

export const ChipIcon = styled.span`
  display: inline-flex;
  color: ${fg.neutral.soft};
`;

export const Panel = styled.div`
  flex: none;
  padding: ${spacing[16]} ${spacing[20]}
    calc(${spacing[20]} + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid ${border.neutral.soft};
  background-color: ${bg.white};
`;

export const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: ${PANEL_MIN_HEIGHT}px;
`;

export const Guide = styled.p`
  ${typography.label1}
  color: ${fg.neutral.light};
  text-align: center;
`;
