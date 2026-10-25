import styled from '@emotion/styled';
import {
  border,
  fg,
  opacity,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

export const Fieldset = styled.fieldset`
  position: relative;
  display: inline-flex;

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;

export const Legend = styled.legend`
  ${visuallyHidden}
`;

export const Stars = styled.span`
  display: inline-flex;
  gap: ${spacing[10]};
`;

export const StarLabel = styled.label<{
  $isFilled: boolean;
  $isDisabled: boolean;
}>`
  position: relative;
  display: inline-flex;
  border-radius: ${radius.xs};
  color: ${({ $isFilled }) => ($isFilled ? fg.neutral.strong : fg.neutral.pale)};
  cursor: ${({ $isDisabled }) => ($isDisabled ? 'not-allowed' : 'pointer')};

  &:has(input:focus-visible) {
    outline: 2px solid ${border.neutral.strong};
    outline-offset: 2px;
  }
`;

export const HiddenRadio = styled.input`
  ${visuallyHidden}
`;

export const Display = styled.span`
  display: inline-flex;
  gap: ${spacing[10]};
`;

export const DisplayStar = styled.span<{ $isFilled: boolean }>`
  display: inline-flex;
  color: ${({ $isFilled }) => ($isFilled ? fg.neutral.strong : fg.neutral.pale)};
`;

export const CompactDisplay = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[2]};
  ${typography.caption1Strong}
  color: ${fg.neutral.strong};
`;
