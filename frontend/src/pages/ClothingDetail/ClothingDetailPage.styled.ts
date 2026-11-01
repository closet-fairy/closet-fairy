import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, fg, radius, spacing } from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

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

export const imageBoxShape = css`
  aspect-ratio: 3 / 2;
  margin-bottom: ${spacing[8]};
  border-radius: ${radius.lg};
`;

export const ImageBox = styled.div`
  position: relative;
  overflow: hidden;
  ${imageBoxShape}
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

export const LoadingMessage = styled.p`
  ${visuallyHidden}
`;

export const DeleteArea = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${spacing[24]};
`;
