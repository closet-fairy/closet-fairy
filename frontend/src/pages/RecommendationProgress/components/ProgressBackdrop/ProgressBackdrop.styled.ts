import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { duration, easing, opacity } from '@/styles/tokens';
import { VIDEO_FADE_DELAY_MS } from './ProgressBackdrop.constants';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }

  to {
    opacity: ${opacity.progressVideo};
  }
`;

export const Container = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  flex: 1;
  flex-direction: column;
`;

/*
 * 흰 바닥은 앱 프레임의 배경이 맡는다. 이 층은 처음 1초 동안 보이지 않다가 1초에 걸쳐 70%까지 나타나고,
 * both로 끝 값을 유지하므로 100%가 되는 일이 없다. 움직임 줄이기에서는 전역 규칙이 나타나는 시간을 없애
 * 1초 뒤에 바로 70%로 보인다.
 */
export const Media = styled.div<{ $isPaused: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  animation: ${fadeIn} ${duration.verySlow} ${easing.enter}
    ${VIDEO_FADE_DELAY_MS}ms both;
  animation-play-state: ${({ $isPaused }) =>
    $isPaused ? 'paused' : 'running'};
`;

export const Video = styled.video`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const Still = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const Foreground = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
`;
