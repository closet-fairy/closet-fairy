import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { bg } from '@/styles/tokens';

const fillStyle = css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const Container = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  isolation: isolate;
`;

export const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background-color: ${bg.splashFallback};
  pointer-events: none;
`;

export const Video = styled.video`
  ${fillStyle}
  opacity: 0;

  &[data-state='back'] {
    opacity: 1;
  }

  &[data-state='front'] {
    z-index: 1;
    opacity: 1;
  }
`;

export const Still = styled.img`
  ${fillStyle}
`;

export const Dim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  background-color: ${bg.dimSplash};
`;

export const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
`;
