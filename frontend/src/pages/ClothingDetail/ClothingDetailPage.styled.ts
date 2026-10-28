import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, fg, radius, spacing } from '@/styles/tokens';

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  background-color: ${bg.white};
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 ${spacing[20]} ${spacing[32]};
`;

export const ImageBox = styled.div`
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 2;
  margin-bottom: ${spacing[8]};
  border-radius: ${radius.lg};
  background-color: ${bg.neutral.light};
`;

export const Image = styled.img`
  position: absolute;
  inset: ${spacing[16]};
  width: calc(100% - ${spacing[32]});
  height: calc(100% - ${spacing[32]});
  object-fit: contain;
`;

export const ImagePlaceholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${fg.neutral.pale};
`;

export const EditImage = styled.div`
  position: absolute;
  right: ${spacing[10]};
  bottom: ${spacing[10]};
`;

export const Spinner = styled.span`
  display: flex;
  color: ${fg.neutral.light};

  & > span {
    animation: ${spin} 1s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    & > span {
      animation: none;
    }
  }
`;
