import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);

  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
};

const getSnapshot = () => document.visibilityState !== 'hidden';

const usePageVisibility = () =>
  useSyncExternalStore(subscribe, getSnapshot, () => true);

export default usePageVisibility;
