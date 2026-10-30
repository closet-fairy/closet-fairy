import styled from '@emotion/styled';
import { bg, radius, shadow, spacing } from '@/styles/tokens';

export const Card = styled.div`
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: ${radius.lg};
  background-color: ${bg.white};
  box-shadow: ${shadow.card};
  container-type: size;
`;

export const Tags = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
  padding: ${spacing[14]} ${spacing[16]};
`;
