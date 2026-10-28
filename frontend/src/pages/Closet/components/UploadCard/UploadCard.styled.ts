import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  opacity,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';

// 목록의 처리 중 카드와 같은 모습으로 보이도록 같은 값을 쓴다.
const PROCESSING_BLUR = '3px';
const STATUS_BADGE_SIZE = 36;
const ACTION_BUTTON_HEIGHT = 32;
const DISMISS_BUTTON_SIZE = 28;
const PRESSED_SCALE = 0.98;
const CAPTION_MIN_HEIGHT = 38;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const ellipsis = css`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

// 치우기 버튼의 넓힌 누르는 영역이 사진 칸의 overflow에 잘리지 않도록 카드에 붙인다.
export const Container = styled.div`
  position: relative;
`;

export const ImageBox = styled.div<{ $isFailed: boolean }>`
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: ${radius.sm};

  ${({ $isFailed }) =>
    $isFailed
      ? css`
          border: 1px dashed ${border.neutral.dashed};
          background-color: ${bg.white};
        `
      : css`
          background-color: ${bg.neutral.default};
        `}
`;

export const Image = styled.img`
  position: absolute;
  inset: ${spacing[4]};
  width: calc(100% - ${spacing[8]});
  height: calc(100% - ${spacing[8]});
  object-fit: contain;
  opacity: ${opacity.disabled};
  filter: blur(${PROCESSING_BLUR});
`;

export const Placeholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: ${spacing[10]};
  color: ${fg.neutral.light};
`;

export const PlaceholderName = styled.span`
  ${typography.caption1}
  ${ellipsis}
  max-width: 100%;
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

export const StatusBadge = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${STATUS_BADGE_SIZE}px;
  height: ${STATUS_BADGE_SIZE}px;
  border-radius: ${radius.full};
  background-color: ${bg.white};
  color: ${fg.neutral.strong};

  & > span {
    animation: ${spin} 1s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    & > span {
      animation: none;
    }
  }
`;

export const StatusLabel = styled.span`
  ${typography.caption1Strong}
  color: ${fg.neutral.default};
`;

export const FailedIcon = styled.span`
  display: flex;
  color: ${fg.neutral.light};
`;

export const ResendButton = styled.button`
  ${typography.caption1Strong}
  position: relative;
  display: flex;
  align-items: center;
  height: ${ACTION_BUTTON_HEIGHT}px;
  padding: 0 ${spacing[10]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.sm};
  background-color: ${bg.white};
  color: ${fg.neutral.strong};
  transition: transform ${duration.fast} ${easing.standard};

  &:active {
    transform: scale(${PRESSED_SCALE});
  }

  /* 보이는 크기는 32px이지만 누르는 영역은 44px로 넓힌다. */
  &::after {
    content: '';
    position: absolute;
    inset: -${spacing[6]} 0;
  }
`;

export const DismissButton = styled.button`
  position: absolute;
  top: ${spacing[4]};
  right: ${spacing[4]};
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${DISMISS_BUTTON_SIZE}px;
  height: ${DISMISS_BUTTON_SIZE}px;
  border-radius: ${radius.full};
  color: ${fg.neutral.light};

  /* 보이는 크기는 28px이지만 누르는 영역은 44px로 넓힌다. */
  &::after {
    content: '';
    position: absolute;
    inset: -${spacing[8]};
  }
`;

export const Caption = styled.div`
  min-height: ${CAPTION_MIN_HEIGHT}px;
  margin-top: ${spacing[6]};
`;

export const ErrorMessage = styled.span`
  ${typography.label1}
  ${ellipsis}
  color: ${fg.neutral.default};
`;
