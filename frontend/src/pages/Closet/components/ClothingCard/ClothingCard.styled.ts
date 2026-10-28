import { css, keyframes } from '@emotion/react';
import type { SerializedStyles } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, fg, opacity, radius, spacing, typography } from '@/styles/tokens';

type ImageTone = 'default' | 'processing' | 'failed';

// 처리 중인 옷은 어떤 옷인지만 알아볼 수 있게 받은 사진을 흐리게 깐다.
const PROCESSING_BLUR = '3px';
const STATUS_BADGE_SIZE = 36;
const RETRY_BUTTON_HEIGHT = 32;
// 이름·분류 두 줄 높이. 처리 중 카드처럼 글이 없어도 줄이 밀리지 않게 자리를 남긴다.
const CAPTION_MIN_HEIGHT = 38;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const IMAGE_BOX_TONE: Record<ImageTone, SerializedStyles> = {
  default: css`
    background-color: ${bg.neutral.light};
  `,
  processing: css`
    background-color: ${bg.neutral.default};
  `,
  failed: css`
    background-color: ${bg.error.light};
  `,
};

const ellipsis = css`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Container = styled.div`
  min-width: 0;
`;

export const ImageBox = styled.div<{ $tone: ImageTone }>`
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: ${radius.sm};
  ${({ $tone }) => IMAGE_BOX_TONE[$tone]}
`;

export const Image = styled.img<{ $isDimmed: boolean }>`
  position: absolute;
  inset: ${spacing[10]};
  width: calc(100% - ${spacing[20]});
  height: calc(100% - ${spacing[20]});
  object-fit: contain;

  ${({ $isDimmed }) =>
    $isDimmed &&
    css`
      inset: ${spacing[4]};
      width: calc(100% - ${spacing[8]});
      height: calc(100% - ${spacing[8]});
      opacity: ${opacity.disabled};
      filter: blur(${PROCESSING_BLUR});
    `}
`;

export const Placeholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${fg.neutral.pale};
`;

export const NewTag = styled.div`
  position: absolute;
  top: ${spacing[6]};
  left: ${spacing[6]};
`;

export const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[6]};
  padding: 0 ${spacing[4]};
`;

export const StatusBadge = styled.span<{ $isQueued: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${STATUS_BADGE_SIZE}px;
  height: ${STATUS_BADGE_SIZE}px;
  border-radius: ${radius.full};
  background-color: ${bg.white};
  color: ${({ $isQueued }) =>
    $isQueued ? fg.neutral.soft : fg.neutral.strong};

  ${({ $isQueued }) =>
    !$isQueued &&
    css`
      & > span {
        animation: ${spin} 1s linear infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        & > span {
          animation: none;
        }
      }
    `}
`;

export const StatusLabel = styled.span<{ $isQueued: boolean }>`
  ${typography.caption1Strong}
  color: ${({ $isQueued }) =>
    $isQueued ? fg.neutral.soft : fg.neutral.default};
`;

export const FailedIcon = styled.span`
  display: flex;
  color: ${fg.error.default};
`;

export const RetryButton = styled.button`
  ${typography.caption1Strong}
  position: relative;
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  height: ${RETRY_BUTTON_HEIGHT}px;
  padding: 0 ${spacing[10]};
  border-radius: ${radius.sm};
  background-color: ${bg.neutral.strong};
  color: ${fg.white};

  /* 보이는 크기는 32px이지만 누르는 영역은 44px로 넓힌다. */
  &::after {
    content: '';
    position: absolute;
    inset: -${spacing[6]} 0;
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;

export const Caption = styled.div`
  min-height: ${CAPTION_MIN_HEIGHT}px;
  margin-top: ${spacing[6]};
`;

export const Name = styled.span<{ $isEmpty: boolean }>`
  ${typography.label1}
  ${ellipsis}
  color: ${({ $isEmpty }) => ($isEmpty ? fg.neutral.light : fg.neutral.strong)};
`;

export const Category = styled.span<{ $isEmpty: boolean }>`
  ${typography.caption1}
  ${ellipsis}
  color: ${({ $isEmpty }) => ($isEmpty ? fg.neutral.pale : fg.neutral.light)};
`;

export const FailedTitle = styled.span`
  ${typography.label1}
  ${ellipsis}
  color: ${fg.neutral.default};
`;

export const FailedHint = styled.span`
  ${typography.caption1}
  ${ellipsis}
  color: ${fg.neutral.pale};
`;
