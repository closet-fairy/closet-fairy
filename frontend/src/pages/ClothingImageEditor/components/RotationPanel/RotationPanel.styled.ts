import { css } from '@emotion/react';
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

// 양옆 90° 버튼(공용 Button md)과 높이를 맞춘다.
const CONTROL_HEIGHT = 48;
const PRESSED_SCALE = 0.98;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[18]};
`;

export const ButtonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[8]};
`;

const pressableStyles = css`
  display: inline-flex;
  flex: none;
  align-items: center;
  height: ${CONTROL_HEIGHT}px;
  border-radius: ${radius.md};
  transition: transform ${duration.fast} ${easing.standard};

  &:active:not(:disabled) {
    transform: scale(${PRESSED_SCALE});
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;

export const ValueButton = styled.button`
  ${pressableStyles}
  ${typography.title2}
  gap: ${spacing[6]};
  padding: 0 ${spacing[14]};
  background-color: ${bg.neutral.light};
  color: ${fg.neutral.strong};
  font-variant-numeric: tabular-nums;
`;

export const ValueIcon = styled.span`
  display: inline-flex;
  color: ${fg.neutral.light};
`;

export const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]};
`;

// 부호 버튼을 누를 때 입력칸 포커스가 빠지면 입력 모드가 닫히므로, 누르는 순간의 기본 동작을 막는 자리다.
export const SignButtonSlot = styled.span`
  display: inline-flex;
  flex: none;
  border-radius: ${radius.md};
  box-shadow: inset 0 0 0 1px ${border.neutral.default};
  color: ${fg.neutral.default};
`;

export const Field = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Unit = styled.span`
  ${typography.body1}
  flex: none;
  color: ${fg.neutral.light};
`;
