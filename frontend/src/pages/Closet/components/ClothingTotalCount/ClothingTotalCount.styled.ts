import styled from '@emotion/styled';
import { fg, typography } from '@/styles/tokens';

export const Count = styled.span`
  ${typography.body3}
  color: ${fg.neutral.soft};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;
