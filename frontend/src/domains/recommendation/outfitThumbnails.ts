import type { OutfitItemResult } from '@/generated/models';

type ThumbnailItem = Pick<OutfitItemResult, 'slot_cd' | 'accessory_type_cd'>;

const THUMBNAIL_CELL_COUNT = 4;

const SLOT_RANK: Partial<Record<OutfitItemResult['slot_cd'], number>> = {
  bottom: 0,
  top: 1,
  outer: 2,
  socks: 4,
  shoes: 5,
};

type AccessoryTypeCd = NonNullable<OutfitItemResult['accessory_type_cd']>;

const ACCESSORY_RANK: Partial<Record<AccessoryTypeCd, number>> = {
  bag: 3,
  scarf: 6,
  belt: 6,
  hat: 7,
};

const SMALLEST_ACCESSORY_RANK = 8;

const getThumbnailRank = (item: ThumbnailItem) => {
  if (item.slot_cd !== 'accessories') {
    return SLOT_RANK[item.slot_cd] ?? SMALLEST_ACCESSORY_RANK;
  }

  return item.accessory_type_cd === null
    ? SMALLEST_ACCESSORY_RANK
    : (ACCESSORY_RANK[item.accessory_type_cd] ?? SMALLEST_ACCESSORY_RANK);
};

// 썸네일 칸은 넷뿐이라, 넘치면 마지막 칸을 남은 개수 표시에 내주고 큰 옷부터 보여 준다.
export const getOutfitThumbnails = <Item extends ThumbnailItem>(
  items: readonly Item[],
) => {
  const sortedItems = [...items].sort(
    (left, right) => getThumbnailRank(left) - getThumbnailRank(right),
  );
  const visibleCount =
    sortedItems.length > THUMBNAIL_CELL_COUNT
      ? THUMBNAIL_CELL_COUNT - 1
      : sortedItems.length;

  return {
    visibleItems: sortedItems.slice(0, visibleCount),
    hiddenCount: sortedItems.length - visibleCount,
  };
};
