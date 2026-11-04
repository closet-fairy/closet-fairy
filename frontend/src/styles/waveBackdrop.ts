import { css } from '@emotion/react';
import waveBackgroundUrl from '@/assets/images/waveBackground.jpg';
import { bg } from './tokens';

export const waveBackdrop = css`
  background: ${bg.white} url(${waveBackgroundUrl}) center / cover no-repeat;
`;
