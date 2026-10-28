import styled from '@emotion/styled';
import { spacing } from '@/styles/tokens';

export const ColorSummary = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[6]};
  min-width: 0;
`;

export const SummaryText = styled.span`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
