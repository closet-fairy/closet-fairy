import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[10]};
`;

export const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${spacing[8]};
`;

const labelStyle = css`
  ${typography.label1Strong}
  color: ${fg.neutral.light};
`;

export const Label = styled.label`
  ${labelStyle}
`;

export const LabelText = styled.span`
  ${labelStyle}
`;

export const Hint = styled.span`
  flex: none;
  ${typography.caption1}
  color: ${fg.neutral.pale};
`;
