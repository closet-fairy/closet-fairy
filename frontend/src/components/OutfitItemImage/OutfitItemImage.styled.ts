import { css } from '@emotion/react';
import styled from '@emotion/styled';
import {
  bg,
  border,
  fg,
  opacity,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';
import { CELL_HEIGHT } from './OutfitItemImage.constants';
import type { OutfitItemImageSize } from './OutfitItemImage';

const IMAGE_MAX_RATIO: Record<OutfitItemImageSize, string> = {
  lg: '76%',
  md: '76%',
  sm: '80%',
};

export const Container = styled.div<{
  $size: OutfitItemImageSize;
  $isDashed: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${({ $size }) => CELL_HEIGHT[$size]};
  aspect-ratio: ${({ $size }) => ($size === 'lg' ? '1 / 1' : 'auto')};
  overflow: hidden;
  border-radius: ${radius.sm};
  background-color: ${bg.neutral.light};

  ${({ $isDashed }) =>
    $isDashed &&
    css`
      border: 1px dashed ${border.neutral.dashed};
      background-color: ${bg.neutral.pale};
    `}
`;

export const Image = styled.img<{
  $size: OutfitItemImageSize;
  $isDeleted: boolean;
}>`
  max-width: ${({ $size }) => IMAGE_MAX_RATIO[$size]};
  max-height: ${({ $size }) => IMAGE_MAX_RATIO[$size]};
  object-fit: contain;
  opacity: ${({ $isDeleted }) => ($isDeleted ? opacity.disabled : 1)};
`;

export const FailedIcon = styled.span`
  display: flex;
  color: ${fg.neutral.pale};
`;

export const Name = styled.span<{ $size: OutfitItemImageSize }>`
  ${({ $size }) =>
    $size === 'lg' ? typography.caption1Strong : typography.caption2Strong}
  padding: 0 ${({ $size }) => ($size === 'lg' ? spacing[8] : spacing[6])};
  color: ${fg.neutral.soft};
  text-align: center;
`;

export const DeletedBadge = styled.span`
  ${typography.caption2Strong}
  position: absolute;
  top: ${spacing[6]};
  left: ${spacing[6]};
  padding: ${spacing[2]} ${spacing[6]};
  border-radius: ${radius.xs};
  background-color: ${bg.white};
  color: ${fg.neutral.soft};
  box-shadow: inset 0 0 0 1px ${border.neutral.default};
`;

export const Badge = styled.span<{ $size: OutfitItemImageSize }>`
  position: absolute;
  top: ${({ $size }) => ($size === 'lg' ? spacing[6] : spacing[4])};
  right: ${({ $size }) => ($size === 'lg' ? spacing[6] : spacing[4])};
  display: flex;
`;
