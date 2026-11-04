import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { CARD_TOP } from '@/pages/RecommendationResult/constants';
import { bg, fg, radius, spacing, typography } from '@/styles/tokens';

const SPIN_DURATION = '1s';
const FOG_SPREAD_BOTTOM = 120;
const FOG_CONTENT_RISE = 80;
const FOG_SHAPE = 'ellipse 70% 45% at 50% 44%';

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Container = styled.div`
  position: relative;
  height: 100%;
`;

export const Card = styled.div`
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: ${radius.lg};
  container-type: size;

  & > button {
    opacity: calc(1 - var(--card-presence, 0));
  }

  [data-card-shown] & > button {
    pointer-events: none;
  }
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
  opacity: calc(1 - var(--card-presence, 0));
  pointer-events: none;
`;

export const Fog = styled.div`
  position: absolute;
  inset: -${CARD_TOP}px calc(${spacing[14]} * -1) -${FOG_SPREAD_BOTTOM}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[12]};
  padding-bottom: ${FOG_CONTENT_RISE}px;
  pointer-events: none;
  background: radial-gradient(
    ${FOG_SHAPE},
    ${bg.fog.dense} 0%,
    ${bg.fog.soft} 55%,
    transparent 100%
  );
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

export const FogTitle = styled.p`
  ${typography.body1Strong}
  color: ${fg.neutral.strong};
`;

export const FogDescription = styled.p`
  ${typography.label1}
  color: ${fg.neutral.light};
`;
