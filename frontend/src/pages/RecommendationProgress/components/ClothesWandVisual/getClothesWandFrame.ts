import {
  BACK_OUT_OVERSHOOT,
  BURST_MS,
  CLOTHES_NAMES,
  CYCLE_MS,
  DOT_ANGLE_OFFSETS,
  DOT_CENTER_ANGLE,
  DOT_END_SCALE,
  DOT_FAR_DISTANCE,
  DOT_NEAR_DISTANCE,
  DOT_SIZE,
  DOT_START_DISTANCE,
  FLICK_START_MS,
  POP_IN_FROM_SCALE,
  POP_IN_MS,
  POP_OUT_MS,
  POP_OUT_TO_SCALE,
  WAND_HIT_ANGLE,
  WAND_MOVE_MS,
  WAND_REST_ANGLE,
  WAND_RETURN_MS,
  WAND_WIND_ANGLE,
  WIND_START_MS,
} from './ClothesWandVisual.constants';
import { CLOTHES_WAND_LAYOUTS } from './ClothesWandVisual.layout';
import type {
  ClothesFrame,
  ClothesWandFrame,
  DotFrame,
} from './ClothesWandVisual.types';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIn = (k: number) => k ** 3;
const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
const backOut = (k: number) =>
  1 +
  (BACK_OUT_OVERSHOOT + 1) * (k - 1) ** 3 +
  BACK_OUT_OVERSHOOT * (k - 1) ** 2;

const getWandAngle = (t: number, isFirstCycle: boolean) => {
  if (t < WAND_RETURN_MS && !isFirstCycle) {
    return lerp(WAND_HIT_ANGLE, WAND_REST_ANGLE, easeOut(t / WAND_RETURN_MS));
  }

  if (t >= FLICK_START_MS) {
    return lerp(
      WAND_WIND_ANGLE,
      WAND_HIT_ANGLE,
      easeIn((t - FLICK_START_MS) / (CYCLE_MS - FLICK_START_MS)),
    );
  }

  if (t >= WIND_START_MS) {
    return lerp(
      WAND_REST_ANGLE,
      WAND_WIND_ANGLE,
      easeInOut((t - WIND_START_MS) / (FLICK_START_MS - WIND_START_MS)),
    );
  }

  return WAND_REST_ANGLE;
};

const getDots = (t: number, tip: { x: number; y: number }): DotFrame[] => {
  const k = clamp(t / BURST_MS);

  return DOT_ANGLE_OFFSETS.map((offset, index) => {
    const radians = ((offset + DOT_CENTER_ANGLE) * Math.PI) / 180;
    const distance = lerp(
      DOT_START_DISTANCE,
      index % 2 === 0 ? DOT_NEAR_DISTANCE : DOT_FAR_DISTANCE,
      easeOut(k),
    );

    return {
      x: tip.x + distance * Math.cos(radians) - DOT_SIZE / 2,
      y: tip.y + distance * Math.sin(radians) - DOT_SIZE / 2,
      opacity: 1 - k,
      scale: lerp(1, DOT_END_SCALE, k),
    };
  });
};

/*
 * 애니메이션을 시작한 뒤 흐른 시간으로 한 순간의 모습을 계산한다. 움직임 줄이기에서는
 * 튀어나오는 크기 변화, 요술봉의 회전과 이동, 점 퍼짐을 빼고 옷만 서서히 바꾼다.
 */
const getClothesWandFrame = (
  elapsedMs: number,
  isReducedMotion: boolean,
): ClothesWandFrame => {
  const cycle = Math.floor(elapsedMs / CYCLE_MS);
  const t = elapsedMs - cycle * CYCLE_MS;
  const isFirstCycle = cycle === 0;
  const currentIndex = cycle % CLOTHES_NAMES.length;
  const previousIndex =
    (currentIndex + CLOTHES_NAMES.length - 1) % CLOTHES_NAMES.length;
  const currentLayout = CLOTHES_WAND_LAYOUTS[CLOTHES_NAMES[currentIndex]];
  const previousLayout = CLOTHES_WAND_LAYOUTS[CLOTHES_NAMES[previousIndex]];
  const popIn = clamp(t / POP_IN_MS);
  const popOut = clamp(t / POP_OUT_MS);

  const clothes = CLOTHES_NAMES.map((_, index): ClothesFrame => {
    if (index === currentIndex) {
      return isReducedMotion
        ? { opacity: popIn, scale: 1 }
        : {
            opacity: popIn,
            scale: lerp(POP_IN_FROM_SCALE, 1, backOut(popIn)),
          };
    }

    if (index === previousIndex && !isFirstCycle) {
      return isReducedMotion
        ? { opacity: 1 - popIn, scale: 1 }
        : {
            opacity: 1 - popOut,
            scale: lerp(1, POP_OUT_TO_SCALE, popOut),
          };
    }

    return { opacity: 0, scale: 1 };
  });

  if (isReducedMotion) {
    return {
      clothes,
      wand: {
        left: currentLayout.wand.left,
        top: currentLayout.wand.top,
        angle: WAND_REST_ANGLE,
      },
      dots: null,
    };
  }

  const move = isFirstCycle ? 1 : easeInOut(clamp(t / WAND_MOVE_MS));

  return {
    clothes,
    wand: {
      left: lerp(previousLayout.wand.left, currentLayout.wand.left, move),
      top: lerp(previousLayout.wand.top, currentLayout.wand.top, move),
      angle: getWandAngle(t, isFirstCycle),
    },
    dots: !isFirstCycle && t < BURST_MS ? getDots(t, previousLayout.tip) : null,
  };
};

export default getClothesWandFrame;
