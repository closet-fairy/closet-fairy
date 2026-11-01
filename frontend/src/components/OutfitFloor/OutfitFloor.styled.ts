import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { FLOOR_ENTRANCE } from '@/domains/recommendation/floorEntrance';
import { FLOOR_CARD } from '@/domains/recommendation/floorLayout.constants';
import { easing, fg, shadow, spacing, typography } from '@/styles/tokens';
import type { OutfitFloorVariant } from './OutfitFloor';

const STAGE_MAX_WIDTH = 480;
const ENTRANCE_DISTANCE = 10;
const TAGLESS_STAGE_SHIFT =
  (FLOOR_CARD.reservedBottom / 2 / FLOOR_CARD.height) * 100;
const SPIN_DURATION = '1s';
const TOUCH_TARGET_SIZE = 44;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// 배치는 362×568 기준으로 계산하고, 무대 크기에 맞춰 칸을 비율로 그려 배치 전체를 통째로 확대·축소한다.
export const Stage = styled.div<{
  $variant: OutfitFloorVariant;
  $hasTagStrip: boolean;
}>`
  position: absolute;
  top: ${({ $variant }) => ($variant === 'floor' ? '50%' : 0)};
  left: 50%;
  width: min(
    100cqw,
    calc(100cqh * ${FLOOR_CARD.width} / ${FLOOR_CARD.height}),
    ${({ $variant }) =>
      $variant === 'floor' ? FLOOR_CARD.width : STAGE_MAX_WIDTH}px
  );
  aspect-ratio: ${FLOOR_CARD.width} / ${FLOOR_CARD.height};
  transform: translate(
    -50%,
    ${({ $variant, $hasTagStrip }) => {
      if ($variant === 'floor') {
        return -50;
      }

      return $hasTagStrip ? 0 : TAGLESS_STAGE_SHIFT;
    }}%
  );
`;

// 옷의 기울기는 인라인 transform에 있어서, 움직임은 개별 속성인 translate로 준다.
const enter = keyframes`
  from {
    opacity: 0;
    translate: 0 -${ENTRANCE_DISTANCE}px;
  }

  to {
    opacity: 1;
    translate: 0 0;
  }
`;

export const Item = styled.div<{
  $isHidden: boolean;
  $entrance?: 'waiting' | 'playing';
}>`
  position: absolute;
  overflow: hidden;
  filter: drop-shadow(${shadow.md});
  pointer-events: none;

  ${({ $isHidden }) =>
    $isHidden &&
    css`
      visibility: hidden;
    `}

  ${({ $entrance }) =>
    $entrance === 'waiting' &&
    css`
      opacity: 0;
    `}

  ${({ $entrance }) =>
    $entrance === 'playing' &&
    css`
      animation: ${enter} ${FLOOR_ENTRANCE.duration}ms ${easing.standard} both;
    `}
`;

export const Image = styled.img`
  position: absolute;
  max-width: none;
`;

export const OverflowButton = styled.button`
  position: absolute;
  right: ${spacing[16]};
  bottom: ${spacing[14]};
  display: flex;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    min-width: ${TOUCH_TARGET_SIZE}px;
    height: ${TOUCH_TARGET_SIZE}px;
    transform: translate(-50%, -50%);
  }
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
