import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, duration } from '@/styles/tokens';

const SHIMMER_PERIOD = '2s';
const SWEEP_END_PERCENT = 62;
const SWEEP_DISTANCE = '120%';

const appear = keyframes`
  to {
    opacity: 1;
  }
`;

const sweep = keyframes`
  0% {
    transform: translateX(-${SWEEP_DISTANCE});
  }

  ${SWEEP_END_PERCENT}%, 100% {
    transform: translateX(${SWEEP_DISTANCE});
  }
`;

export const Container = styled.div<{ $delay: number }>`
  position: relative;
  overflow: hidden;
  opacity: 0;
  animation: ${appear} 1ms linear ${duration.normal} forwards;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 22%,
      ${bg.veil} 50%,
      transparent 78%
    );
    pointer-events: none;
    transform: translateX(-${SWEEP_DISTANCE});
    animation: ${sweep} ${SHIMMER_PERIOD} ease-in-out
      ${({ $delay }) => $delay}ms infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      display: none;
    }
  }
`;
