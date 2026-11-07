import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);

  mediaQueryList.addEventListener('change', onChange);

  return () => {
    mediaQueryList.removeEventListener('change', onChange);
  };
};

const getSnapshot = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches;

const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribe, getSnapshot, () => false);

export default usePrefersReducedMotion;
