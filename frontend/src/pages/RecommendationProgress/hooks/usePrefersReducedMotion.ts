import { useSyncExternalStore } from 'react';
import isReducedMotion, { REDUCED_MOTION_QUERY } from '@/utils/isReducedMotion';

const subscribe = (onChange: () => void) => {
  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);

  mediaQueryList.addEventListener('change', onChange);

  return () => {
    mediaQueryList.removeEventListener('change', onChange);
  };
};

const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribe, isReducedMotion, () => false);

export default usePrefersReducedMotion;
