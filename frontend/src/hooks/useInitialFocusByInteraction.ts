import type { RefObject } from 'react';

let lastInteractionType = '';

/*
 * 오버레이를 여는 탭은 오버레이가 마운트되기 전에 일어날 수 있어서,
 * 리스너는 오버레이와 상관없이 모듈을 불러올 때 한 번만 붙인다.
 */
document.addEventListener(
  'pointerdown',
  (event) => {
    lastInteractionType = event.pointerType;
  },
  true,
);
document.addEventListener(
  'keydown',
  () => {
    lastInteractionType = 'keyboard';
  },
  true,
);

const useInitialFocusByInteraction = (
  popupRef: RefObject<HTMLElement | null>,
) => {
  return (openType: string) => {
    const interactionType = openType || lastInteractionType;

    return interactionType === 'touch' ? popupRef.current : true;
  };
};

export default useInitialFocusByInteraction;
