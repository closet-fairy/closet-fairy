import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';
import type { OutfitItemImageSize } from './OutfitItemImage';

const CELL_HEIGHT: Record<OutfitItemImageSize, number> = {
  md: 78,
  sm: 62,
};

const IMAGE_MAX_RATIO: Record<OutfitItemImageSize, string> = {
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
  height: ${({ $size }) => CELL_HEIGHT[$size]}px;
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

export const Image = styled.img<{ $size: OutfitItemImageSize }>`
  max-width: ${({ $size }) => IMAGE_MAX_RATIO[$size]};
  max-height: ${({ $size }) => IMAGE_MAX_RATIO[$size]};
  object-fit: contain;
`;

export const FailedIcon = styled.span`
  display: flex;
  color: ${fg.neutral.pale};
`;

export const Name = styled.span`
  ${typography.caption2Strong}
  padding: 0 ${spacing[6]};
  color: ${fg.neutral.soft};
  text-align: center;
`;

export const Badge = styled.span`
  position: absolute;
  top: ${spacing[4]};
  right: ${spacing[4]};
  display: flex;
`;
