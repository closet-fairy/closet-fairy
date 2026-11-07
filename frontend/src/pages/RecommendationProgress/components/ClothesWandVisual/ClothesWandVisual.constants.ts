import type { IconName } from '@/assets/icons';
import {
  LAYOUT_BOX_SIZE,
  LAYOUT_CLOTHES_SIZE,
  LAYOUT_WAND_SIZE,
} from './ClothesWandVisual.layout';

export const CLOTHES_NAMES = [
  'apparel',
  'dry_cleaning',
  'steps',
  'shopping_bag',
  'eyeglasses',
  'watch',
] as const satisfies readonly IconName[];

// 위치 표를 만들 때 쓴 크기이다. 바꾸려면 스크립트의 크기를 고치고 표를 다시 만든다.
export const VISUAL_BOX_SIZE = LAYOUT_BOX_SIZE;
export const CLOTHES_ICON_SIZE = LAYOUT_CLOTHES_SIZE;
export const WAND_ICON_SIZE = LAYOUT_WAND_SIZE;
// 요술봉 손잡이 끝. 좌우 반전 전 상자 기준이다.
export const WAND_PIVOT = '12% 88%';

// 옷 하나당 주기. 주기가 끝나는 순간이 요술봉이 톡 치는 순간이자 옷이 바뀌는 순간이다.
export const CYCLE_MS = 2000;
export const POP_IN_MS = 300;
export const POP_OUT_MS = 160;
export const BURST_MS = 420;
export const WAND_RETURN_MS = 440;
export const WAND_MOVE_MS = 560;
export const WIND_START_MS = 1360;
export const FLICK_START_MS = 1790;

export const POP_IN_FROM_SCALE = 0.55;
export const POP_OUT_TO_SCALE = 0.7;
export const BACK_OUT_OVERSHOOT = 1.9;

export const WAND_REST_ANGLE = 0;
export const WAND_WIND_ANGLE = -16;
export const WAND_HIT_ANGLE = 14;

export const DOT_SIZE = 4;
export const DOT_ANGLE_OFFSETS = [-80, -40, 0, 40, 80] as const;
export const DOT_CENTER_ANGLE = -135;
export const DOT_START_DISTANCE = 4;
export const DOT_NEAR_DISTANCE = 18;
export const DOT_FAR_DISTANCE = 24;
export const DOT_END_SCALE = 0.4;

// 한 프레임이 이보다 오래 걸렸다면 멈춰 있던 것으로 보고 이 값까지만 애니메이션 시계에 더한다.
export const MAX_FRAME_GAP_MS = 100;
