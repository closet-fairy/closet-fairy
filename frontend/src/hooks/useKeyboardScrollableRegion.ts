import { useCallback } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/*
 * 스크롤 영역 안에 포커스할 요소가 없으면 키보드로는 그 영역을 스크롤할 수 없어서, 그때만 영역 자체를 포커스 대상으로 만든다.
 * 포커스할 요소가 있을 때까지 영역에 포커스를 주면 오버레이를 열었을 때 첫 포커스가 입력 요소 대신 영역으로 가므로 그 경우는 뺀다.
 * 오버레이는 포털로 늦게 마운트되고 내용도 바뀔 수 있어서, 요소가 붙는 순간과 내용이 바뀔 때마다 다시 판단한다.
 */
const useKeyboardScrollableRegion = () => {
  return useCallback((region: HTMLElement | null) => {
    if (region === null) {
      return;
    }

    const updateTabIndex = () => {
      if (region.querySelector(FOCUSABLE_SELECTOR) === null) {
        region.tabIndex = 0;
      } else {
        region.removeAttribute('tabindex');
      }
    };

    updateTabIndex();

    const observer = new MutationObserver(updateTabIndex);
    observer.observe(region, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);
};

export default useKeyboardScrollableRegion;
