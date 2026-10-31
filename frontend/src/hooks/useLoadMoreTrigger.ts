import { useCallback } from 'react';

// 목록 끝 요소가 화면 아래쪽 이만큼 앞에 다가오면 미리 다음 묶음을 불러온다.
const PREFETCH_MARGIN = '320px';

interface UseLoadMoreTriggerOptions {
  isEnabled: boolean;
  onLoadMore: () => void;
}

// 돌려준 ref를 목록 끝 요소에 붙이면, 그 요소가 화면에 들어올 때 onLoadMore를 부른다.
const useLoadMoreTrigger = (options: UseLoadMoreTriggerOptions) => {
  const { isEnabled, onLoadMore } = options;

  return useCallback(
    (element: HTMLElement | null) => {
      if (element === null || !isEnabled) {
        return undefined;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            onLoadMore();
          }
        },
        { rootMargin: `0px 0px ${PREFETCH_MARGIN} 0px` },
      );
      observer.observe(element);

      return () => observer.disconnect();
    },
    [isEnabled, onLoadMore],
  );
};

export default useLoadMoreTrigger;
