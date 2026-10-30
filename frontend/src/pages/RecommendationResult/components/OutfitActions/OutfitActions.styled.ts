import { css } from '@emotion/react';
import type { SerializedStyles } from '@emotion/react';
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

type ActionVariant = 'main' | 'sub';

const SAFE_BOTTOM_GAP = 52;

// 화면 아래에서 버튼 띠가 차지하는 높이다. 아래쪽 안전 영역은 뺀 값이다.
export const OUTFIT_ACTIONS_HEIGHT = 150;
const PRESSED_SCALE = 0.94;

const CIRCLE_SIZE: Record<ActionVariant, number> = {
  main: 76,
  sub: 58,
};

const CIRCLE_STYLE: Record<ActionVariant, SerializedStyles> = {
  main: css`
    width: ${CIRCLE_SIZE.main}px;
    height: ${CIRCLE_SIZE.main}px;
    background-color: ${bg.neutral.strong};
    color: ${fg.white};
    box-shadow: ${shadow.lg};
  `,
  sub: css`
    width: ${CIRCLE_SIZE.sub}px;
    height: ${CIRCLE_SIZE.sub}px;
    background-color: ${bg.white};
    color: ${fg.neutral.default};
    box-shadow: ${shadow.md};
  `,
};

const LABEL_STYLE: Record<ActionVariant, SerializedStyles> = {
  main: css`
    ${typography.caption2Strong}
    color: ${fg.neutral.strong};
  `,
  sub: css`
    ${typography.caption2}
    color: ${fg.neutral.soft};
  `,
};

export const Container = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: ${spacing[24]};
  padding-bottom: calc(${SAFE_BOTTOM_GAP}px + env(safe-area-inset-bottom, 0px));
`;

export const Action = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[8]};
  transition: transform ${duration.fast} ${easing.standard};

  &:active:not(:disabled) {
    transform: scale(${PRESSED_SCALE});
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;

export const Circle = styled.span<{ $variant: ActionVariant }>`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${radius.full};

  ${({ $variant }) => CIRCLE_STYLE[$variant]}
`;

// 라벨이 원보다 넓어져도 세 버튼의 간격이 시안과 같도록 버튼 폭은 원에 맞추고 라벨만 양옆으로 넘긴다.
export const Label = styled.span<{ $variant: ActionVariant }>`
  width: ${({ $variant }) => CIRCLE_SIZE[$variant]}px;
  white-space: nowrap;
  display: flex;
  justify-content: center;

  ${({ $variant }) => LABEL_STYLE[$variant]}
`;
