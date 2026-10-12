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

const resolveInitialFocus = (openType: string, popup: HTMLElement | null) => {
  const interactionType = openType || lastInteractionType;

  return interactionType === 'touch' ? popup : true;
};

export default resolveInitialFocus;
