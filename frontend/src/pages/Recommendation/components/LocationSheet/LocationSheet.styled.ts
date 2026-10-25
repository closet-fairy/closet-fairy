import styled from '@emotion/styled';
import { spacing } from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

export const Status = styled.p`
  ${visuallyHidden}
`;

export const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[10]};
`;
