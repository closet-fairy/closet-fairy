import styled from '@emotion/styled';
import { bg, spacing } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 0 ${spacing[32]};
  background-color: ${bg.white};
`;
