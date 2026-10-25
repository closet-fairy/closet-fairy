import styled from '@emotion/styled';
import { spacing } from '@/styles/tokens';

export const Status = styled.p`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

export const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[10]};
`;
