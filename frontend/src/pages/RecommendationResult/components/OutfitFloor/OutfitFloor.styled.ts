import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { FLOOR_CARD } from '@/domains/recommendation/floorLayout.constants';
import { fg, shadow, spacing, typography } from '@/styles/tokens';

const STAGE_MAX_WIDTH = 480;
const TAGLESS_STAGE_SHIFT =
  (FLOOR_CARD.reservedBottom / 2 / FLOOR_CARD.height) * 100;
const SPIN_DURATION = '1s';

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// 배치는 362×568 기준으로 계산하고, 무대 크기에 맞춰 칸을 비율로 그려 배치 전체를 통째로 확대·축소한다.
export const Stage = styled.div<{ $hasTagStrip: boolean }>`
  position: absolute;
  top: 0;
  left: 50%;
  width: min(
    100cqw,
    calc(100cqh * ${FLOOR_CARD.width} / ${FLOOR_CARD.height}),
    ${STAGE_MAX_WIDTH}px
  );
  aspect-ratio: ${FLOOR_CARD.width} / ${FLOOR_CARD.height};
  transform: translate(
    -50%,
    ${({ $hasTagStrip }) => ($hasTagStrip ? 0 : TAGLESS_STAGE_SHIFT)}%
  );
`;

export const Item = styled.div<{ $isHidden: boolean }>`
  position: absolute;
  overflow: hidden;
  filter: drop-shadow(${shadow.md});
  pointer-events: none;

  ${({ $isHidden }) =>
    $isHidden &&
    css`
      visibility: hidden;
    `}
`;

export const Image = styled.img`
  position: absolute;
  max-width: none;
`;

export const Waiting = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${fg.neutral.pale};

  & > span {
    animation: ${spin} ${SPIN_DURATION} linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    & > span {
      animation: none;
    }
  }
`;

export const Empty = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[12]};
  padding: 0 ${spacing[40]};
  text-align: center;
`;

export const EmptyIcon = styled.span`
  display: flex;
  color: ${fg.neutral.pale};
`;

export const EmptyTitle = styled.p`
  ${typography.body1Strong}
  color: ${fg.neutral.strong};
`;

export const EmptyDescription = styled.p`
  ${typography.label1}
  color: ${fg.neutral.light};
`;
