import styled from '@emotion/styled';
import { bg } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  background-color: ${bg.white};
`;

export const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;
