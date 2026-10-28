import { css } from '@emotion/react';
import styled from '@emotion/styled';
import type { PhotoTileState } from '@/pages/Closet/types';
import {
  bg,
  border,
  fg,
  opacity,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';

const CHECK_MARK_SIZE = 26;

export const Tile = styled.button<{ $state: PhotoTileState }>`
  position: relative;
  display: block;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 3 / 4;
  border: 2px solid
    ${({ $state }) =>
      $state === 'selected' ? border.neutral.strong : 'transparent'};
  border-radius: ${radius.md};
  background-color: ${bg.neutral.light};
`;

// 버린 사진은 흐리게, 더 고를 수 없는 사진은 더 흐리게 둬서 누를 수 있는지 구분한다.
const PREVIEW_OPACITY: Record<PhotoTileState, number> = {
  selected: 1,
  discarded: opacity.disabled,
  locked: opacity.faint,
};

export const Preview = styled.div<{ $state: PhotoTileState }>`
  position: absolute;
  inset: 0;
  opacity: ${({ $state }) => PREVIEW_OPACITY[$state]};
`;

export const Image = styled.img`
  position: absolute;
  inset: ${spacing[10]};
  width: calc(100% - ${spacing[20]});
  height: calc(100% - ${spacing[20]});
  object-fit: contain;
`;

export const Placeholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[8]};
  padding: ${spacing[10]};
  color: ${fg.neutral.pale};
`;

export const FileName = styled.span`
  ${typography.caption1}
  overflow: hidden;
  max-width: 100%;
  color: ${fg.neutral.light};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const CheckMark = styled.span<{ $isChecked: boolean }>`
  position: absolute;
  top: ${spacing[8]};
  right: ${spacing[8]};
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${CHECK_MARK_SIZE}px;
  height: ${CHECK_MARK_SIZE}px;
  border-radius: ${radius.full};

  ${({ $isChecked }) =>
    $isChecked
      ? css`
          background-color: ${bg.neutral.strong};
          color: ${fg.white};
        `
      : css`
          border: 1.5px solid ${border.neutral.strong};
          background-color: ${bg.white};
          opacity: ${opacity.disabled};
        `}
`;

export const StateLabel = styled.span`
  ${typography.label1Strong}
  position: absolute;
  right: 0;
  bottom: ${spacing[14]};
  left: 0;
  color: ${fg.neutral.default};
  text-align: center;
`;
