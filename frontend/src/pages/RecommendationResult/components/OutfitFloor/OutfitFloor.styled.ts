import styled from '@emotion/styled';
import { fg, shadow, spacing, typography } from '@/styles/tokens';
import type { FloorSlot } from './OutfitFloor';

const STAGE_WIDTH = 362;
const STAGE_HEIGHT = 568;

interface SlotPosition {
  left: number;
  top: number;
  width: number;
  rotate: number;
}

const SLOT_POSITION: Record<FloorSlot, SlotPosition> = {
  hat: { left: 196, top: 24, width: 132, rotate: -11 },
  top: { left: 22, top: 118, width: 170, rotate: 8 },
  bottom: { left: 122, top: 236, width: 272, rotate: -7 },
  shoes: { left: 28, top: 452, width: 158, rotate: -6 },
};

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

// 카드 높이는 화면마다 달라서, 시안의 카드 비율을 지킨 무대 안에서 옷 자리를 비율로 잡는다.
export const Stage = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  width: min(100cqw, calc(100cqh * ${STAGE_WIDTH} / ${STAGE_HEIGHT}));
  aspect-ratio: ${STAGE_WIDTH} / ${STAGE_HEIGHT};
  transform: translateX(-50%);
`;

export const Item = styled.img<{ $slot: FloorSlot }>`
  position: absolute;
  left: ${({ $slot }) => toPercent(SLOT_POSITION[$slot].left, STAGE_WIDTH)};
  top: ${({ $slot }) => toPercent(SLOT_POSITION[$slot].top, STAGE_HEIGHT)};
  width: ${({ $slot }) => toPercent(SLOT_POSITION[$slot].width, STAGE_WIDTH)};
  filter: drop-shadow(${shadow.md});
  pointer-events: none;
  transform: rotate(${({ $slot }) => SLOT_POSITION[$slot].rotate}deg);
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
