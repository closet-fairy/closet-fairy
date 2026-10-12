import { useCallback } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/*
 * 넘치는 스크롤 영역 안에 포커스할 요소가 없으면 키보드로는 그 영역을 스크롤할 수 없어서, 그때만 영역 자체를 포커스 대상으로 만든다.
 * 넘치지 않거나 포커스할 요소가 있을 때 영역에 포커스를 주면, 오버레이를 열었을 때 첫 포커스가 버튼이나 입력 요소 대신 영역으로 간다.
 * 오버레이는 포털로 늦게 마운트되고 내용과 크기도 바뀌어서, 요소가 붙는 순간과 내용·크기가 바뀔 때마다 다시 판단한다.
 */
const useKeyboardScrollableRegion = () => {
  return useCallback((region: HTMLElement | null) => {
    if (region === null) {
      return;
    }

    const updateTabIndex = () => {
      const isOverflowing = region.scrollHeight > region.clientHeight;
      const hasFocusable = region.querySelector(FOCUSABLE_SELECTOR) !== null;
      const shouldBeFocusable = isOverflowing && !hasFocusable;

      if (shouldBeFocusable && region.getAttribute('tabindex') !== '0') {
        region.tabIndex = 0;
      }

      if (!shouldBeFocusable && region.hasAttribute('tabindex')) {
        region.removeAttribute('tabindex');
      }
    };

    const resizeObserver = new ResizeObserver(updateTabIndex);

    const observeSizes = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(region);
      Array.from(region.children).forEach((child) => {
        resizeObserver.observe(child);
      });
    };

    const mutationObserver = new MutationObserver(() => {
      observeSizes();
      updateTabIndex();
    });

    updateTabIndex();
    observeSizes();
    mutationObserver.observe(region, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'type'],
    });

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);
};

export default useKeyboardScrollableRegion;
