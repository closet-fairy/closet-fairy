import { spacing } from '@/styles/tokens';

const CLOSET_PAGE_SIZE = 20;

export const CLOSET_LIST_PARAMS = { limit: CLOSET_PAGE_SIZE } as const;

export const GRID_COLUMN_COUNT = 3;

export const FIRST_LOAD_SKELETON_COUNT = 15;
export const NEXT_PAGE_SKELETON_ROW_COUNT = 2;

export const GRID_COLUMN_GAP = spacing[8];

export const REGISTER_PRESSED_SCALE = 0.94;
