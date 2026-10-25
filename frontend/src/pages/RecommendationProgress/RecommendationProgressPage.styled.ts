import styled from '@emotion/styled';
import { duration, easing } from '@/styles/tokens';

export const CancelAction = styled.div<{ $isVisible: boolean }>`
  display: flex;
  opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
  visibility: ${({ $isVisible }) => ($isVisible ? 'visible' : 'hidden')};
  transition:
    opacity ${duration.slow} ${easing.enter},
    visibility 0s;
`;
