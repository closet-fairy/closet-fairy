import type { RefObject } from 'react';
import { useEffect } from 'react';

let lastInteractionType = '';
let subscriberCount = 0;

const handlePointerDown = (event: PointerEvent) => {
  lastInteractionType = event.pointerType;
};

const handleKeyDown = () => {
  lastInteractionType = 'keyboard';
};

const subscribe = () => {
  if (subscriberCount === 0) {
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
  }
  subscriberCount += 1;

  return () => {
    subscriberCount -= 1;

    if (subscriberCount === 0) {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    }
  };
};

const useInitialFocusByInteraction = (
  popupRef: RefObject<HTMLElement | null>,
) => {
  useEffect(subscribe, []);

  return (openType: string) => {
    const interactionType = openType || lastInteractionType;

    return interactionType === 'touch' ? popupRef.current : true;
  };
};

export default useInitialFocusByInteraction;
