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

const FIELD_HEIGHT = 96;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[6]};
`;

export const Field = styled.div<{ $hasError: boolean; $isDisabled: boolean }>`
  display: flex;
  flex-direction: column;
  height: ${FIELD_HEIGHT}px;
  padding: ${spacing[12]} ${spacing[14]};
  border: 1px solid
    ${({ $hasError }) =>
      $hasError ? border.error.default : border.neutral.default};
  border-radius: ${radius.md};
  background-color: ${bg.white};
  color: ${fg.neutral.strong};
  opacity: ${({ $isDisabled }) => ($isDisabled ? opacity.disabled : 1)};
  transition: border-color ${duration.fast} ${easing.standard};

  &:focus-within {
    border-color: ${({ $hasError }) =>
      $hasError ? border.error.default : border.neutral.strong};
  }
`;

export const Input = styled.textarea`
  ${typography.body2}
  flex: 1;
  min-height: 0;
  border: 0;
  background: none;
  color: inherit;
  resize: none;

  &::placeholder {
    color: ${fg.neutral.light};
  }

  &:focus-visible {
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 1;
    -webkit-text-fill-color: currentColor;
  }
`;

export const Counter = styled.span<{ $isOverLimit: boolean }>`
  ${typography.caption1}
  flex: none;
  align-self: flex-end;
  color: ${({ $isOverLimit }) =>
    $isOverLimit ? fg.error.default : fg.neutral.pale};
  font-variant-numeric: tabular-nums;
`;

export const ErrorMessage = styled.p`
  ${typography.caption1}
  color: ${fg.error.default};
`;
