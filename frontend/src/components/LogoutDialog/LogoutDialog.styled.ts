import styled from '@emotion/styled';
import { fg, typography } from '@/styles/tokens';

export const ErrorMessage = styled.p`
  ${typography.label1}
  color: ${fg.error.default};
  text-align: center;
`;
