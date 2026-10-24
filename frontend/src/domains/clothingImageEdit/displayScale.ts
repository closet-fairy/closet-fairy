import type { Size } from './types';

export const getContainScale = (container: Size, content: Size) =>
  Math.min(container.width / content.width, container.height / content.height);

/*
 * 회전 단계에서 쓰는 배율이다. 어떤 각도로 돌려도 그림의 대각선이 영역 안에 들어가게 잡아,
 * 돌리는 동안 옷이 커졌다 작아졌다 하지 않는다.
 */
export const getDiagonalScale = (container: Size, content: Size) =>
  Math.min(container.width, container.height) /
  Math.hypot(content.width, content.height);
