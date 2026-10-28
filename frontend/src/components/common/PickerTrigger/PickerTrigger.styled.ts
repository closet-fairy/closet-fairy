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

const TRIGGER_HEIGHT = 64;

export const Trigger = styled.button<{ $isInvalid: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[4]};
  width: 100%;
  min-height: ${TRIGGER_HEIGHT}px;
  padding: ${spacing[8]} ${spacing[12]};
  border: 1px solid
    ${({ $isInvalid }) =>
      $isInvalid ? border.error.default : border.neutral.default};
  border-radius: ${radius.md};
  background-color: ${bg.white};
  text-align: center;
  transition: background-color ${duration.fast} ${easing.standard};

  &:disabled {
    opacity: ${opacity.disabled};
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background-color: ${bg.neutral.pale};
    }
  }
`;

export const Caption = styled.span`
  ${typography.caption2}
  color: ${fg.neutral.light};
`;

export const Value = styled.span`
  ${typography.title2}
  color: ${fg.neutral.strong};
`;

export const Placeholder = styled.span`
  ${typography.title2}
  color: ${fg.neutral.pale};
`;
