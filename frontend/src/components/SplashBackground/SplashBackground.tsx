import { useState } from 'react';
import type { ReactNode } from 'react';
import splashStillUrl from '@/assets/images/splashStill.jpg';
import isDataSaverEnabled from '@/utils/isDataSaverEnabled';
import isReducedMotion from '@/utils/isReducedMotion';
import { SPLASH_VIDEO_URLS } from './SplashBackground.constants';
import * as S from './SplashBackground.styled';
import useSplashVideoLoop from './useSplashVideoLoop';

interface SplashBackgroundProps {
  children: ReactNode;
}

type BackdropKind = 'plain' | 'still' | 'video';

const getBackdropKind = (): BackdropKind => {
  if (isDataSaverEnabled()) return 'plain';

  return isReducedMotion() ? 'still' : 'video';
};

const SplashBackground = (props: SplashBackgroundProps) => {
  const { children } = props;
  const [kind] = useState(getBackdropKind);
  const { firstRef, secondRef } = useSplashVideoLoop(
    SPLASH_VIDEO_URLS,
    kind === 'video',
  );

  return (
    <S.Container>
      <S.Backdrop aria-hidden>
        {kind === 'still' && (
          <S.Still data-testid="splash-still" src={splashStillUrl} alt="" />
        )}
        {kind === 'video' && (
          <>
            <S.Video
              ref={firstRef}
              data-testid="splash-video"
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              disablePictureInPicture
              disableRemotePlayback
            />
            <S.Video
              ref={secondRef}
              data-testid="splash-video"
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              disablePictureInPicture
              disableRemotePlayback
            />
          </>
        )}
        <S.Dim />
      </S.Backdrop>
      <S.Content>{children}</S.Content>
    </S.Container>
  );
};

export default SplashBackground;
