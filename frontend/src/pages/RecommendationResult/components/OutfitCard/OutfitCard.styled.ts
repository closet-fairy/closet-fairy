import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, fg, radius, shadow, spacing, typography } from '@/styles/tokens';

const SPIN_DURATION = '1s';

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Card = styled.div<{ $isPrevious: boolean; $isLifted: boolean }>`
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: ${radius.lg};
  background-color: ${({ $isPrevious }) =>
    $isPrevious ? bg.card.previous : bg.white};
  box-shadow: ${({ $isLifted }) => ($isLifted ? shadow.lifted : shadow.card)};
  container-type: size;
`;

export const Badge = styled.div`
  position: absolute;
  top: ${spacing[14]};
  left: ${spacing[14]};
  display: flex;
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

export const Cover = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[12]};
  background-color: ${bg.veil};
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

export const CoverTitle = styled.p`
  ${typography.body1Strong}
  color: ${fg.neutral.strong};
`;

export const CoverDescription = styled.p`
  ${typography.label1}
  color: ${fg.neutral.light};
`;
