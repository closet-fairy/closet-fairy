import type { IconName } from '@/assets/icons';
import { icons } from '@/assets/icons';

export const ICON_NAMES = Object.keys(icons).filter(
  (name): name is IconName => name in icons,
);
