import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import progressSilkStill from '@/assets/images/progressSilkStill.jpg';
import progressSilkVideo from '@/assets/videos/progressSilk.mp4';
import isDataSaverEnabled from '@/utils/isDataSaverEnabled';
import usePageVisibility from '../../hooks/usePageVisibility';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import * as S from './ProgressBackdrop.styled';

interface ProgressBackdropProps {
  children: ReactNode;
}

const ProgressBackdrop = (props: ProgressBackdropProps) => {
  const { children } = props;
  const isReducedMotion = usePrefersReducedMotion();
  const isPageVisible = usePageVisibility();
  const [isDataSaver] = useState(isDataSaverEnabled);
  const [isVideoFailed, setIsVideoFailed] = useState(false);
  const [isStillFailed, setIsStillFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shouldPlayVideo = !isReducedMotion && !isDataSaver && !isVideoFailed;

  useEffect(() => {
    const video = videoRef.current;

    if (!shouldPlayVideo || video === null) {
      return;
    }

    if (!isPageVisible) {
      video.pause();
      return;
    }

    video.defaultMuted = true;
    video.muted = true;
    video.play().catch((error: unknown) => {
      // 보이지 않아 멈춘 재생이 끊긴 것은 실패가 아니다.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setIsVideoFailed(true);
    });
  }, [isPageVisible, shouldPlayVideo]);

  return (
    <S.Container>
      <S.Media
        data-testid="progress-media"
        $isPaused={!isPageVisible}
        aria-hidden
      >
        {shouldPlayVideo ? (
          <S.Video
            ref={videoRef}
            data-testid="progress-video"
            src={progressSilkVideo}
            poster={progressSilkStill}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            tabIndex={-1}
            disablePictureInPicture
            disableRemotePlayback
            onError={() => setIsVideoFailed(true)}
          />
        ) : (
          !isStillFailed && (
            <S.Still
              data-testid="progress-still"
              src={progressSilkStill}
              alt=""
              onError={() => setIsStillFailed(true)}
            />
          )
        )}
      </S.Media>
      <S.Foreground>{children}</S.Foreground>
    </S.Container>
  );
};

export default ProgressBackdrop;
