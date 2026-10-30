import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

const SPIN_DURATION = '1s';

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[16]};
`;

export const Spinner = styled.span`
  display: flex;
  color: ${fg.neutral.strong};

  & > span {
    animation: ${spin} ${SPIN_DURATION} linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    & > span {
      animation: none;
    }
  }
`;

export const Text = styled.p`
  ${typography.body3}
  color: ${fg.neutral.light};
`;
