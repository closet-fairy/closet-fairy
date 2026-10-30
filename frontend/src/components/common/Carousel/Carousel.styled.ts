import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { fg, spacing } from '@/styles/tokens';

const SLIDE_GAP = spacing[16];

export const Root = styled.section`
  position: relative;
`;

export const Viewport = styled.div`
  overflow: hidden;
`;

export const Container = styled.div`
  display: flex;
  margin-left: calc(${SLIDE_GAP} * -1);
  touch-action: pan-y pinch-zoom;
`;

export const Slide = styled.div`
  flex: 0 0 100%;
  min-width: 0;
  padding-left: ${SLIDE_GAP};
`;

export const ArrowSlot = styled.span<{
  $side: 'prev' | 'next';
  $inset: string;
}>`
  position: absolute;
  top: 50%;
  display: flex;
  color: ${fg.neutral.default};
  transform: translateY(-50%);

  ${({ $side, $inset }) =>
    $side === 'prev'
      ? css`
          left: ${$inset};
        `
      : css`
          right: ${$inset};
        `}
`;
