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
import { FIELD_HEIGHT } from './TextField.constants';

const CLEAR_BUTTON_SIZE = 44;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[6]};
`;

export const Field = styled.div<{ $hasError: boolean; $isDisabled: boolean }>`
  display: flex;
  align-items: center;
  gap: ${spacing[10]};
  height: ${FIELD_HEIGHT}px;
  padding: 0 ${spacing[14]};
  border: 1px solid
    ${({ $hasError }) =>
      $hasError ? border.error.default : border.neutral.default};
  border-radius: ${radius.md};
  background-color: ${bg.white};
  color: ${fg.neutral.strong};
  opacity: ${({ $isDisabled }) => ($isDisabled ? opacity.disabled : 1)};
  transition:
    border-color ${duration.fast} ${easing.standard},
    box-shadow ${duration.fast} ${easing.standard};

  &:focus-within {
    border-color: ${({ $hasError }) =>
      $hasError ? border.error.default : border.neutral.strong};
    box-shadow: inset 0 0 0 1px
      ${({ $hasError }) =>
        $hasError ? border.error.default : border.neutral.strong};
  }
`;

export const LeadingIcon = styled.span`
  display: inline-flex;
  flex: none;
  color: ${fg.neutral.light};
`;

export const Input = styled.input`
  flex: 1;
  min-width: 0;
  height: 100%;
  ${typography.body1}
  border: 0;
  background: none;
  color: inherit;
  appearance: none;

  &::-webkit-search-decoration,
  &::-webkit-search-cancel-button {
    appearance: none;
  }

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
  flex: none;
  ${typography.caption1}
  color: ${({ $isOverLimit }) =>
    $isOverLimit ? fg.error.default : fg.neutral.pale};
  font-variant-numeric: tabular-nums;
`;

export const ClearButton = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: ${CLEAR_BUTTON_SIZE}px;
  height: ${CLEAR_BUTTON_SIZE}px;
  margin-right: -${spacing[12]};
  color: ${fg.neutral.pale};
`;

export const ErrorMessage = styled.p`
  ${typography.caption1}
  color: ${fg.error.default};
`;
