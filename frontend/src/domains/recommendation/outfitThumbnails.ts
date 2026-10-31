import type { OutfitItemResult } from '@/generated/models';

type ThumbnailItem = Pick<OutfitItemResult, 'slot_cd' | 'accessory_type_cd'>;
type SlotCd = Exclude<OutfitItemResult['slot_cd'], 'accessories'>;
type AccessoryTypeCd = NonNullable<OutfitItemResult['accessory_type_cd']>;

const THUMBNAIL_CELL_COUNT = 4;

const HEAD_TO_TOE_ORDER: readonly (SlotCd | AccessoryTypeCd)[] = [
  'hat',
  'eyewear',
  'outer',
  'top',
  'scarf',
  'bag',
  'belt',
  'watch',
  'bottom',
  'socks',
  'shoes',
  'jewelry',
  'etc',
];

const getThumbnailRank = (item: ThumbnailItem) =>
  HEAD_TO_TOE_ORDER.indexOf(
    item.slot_cd === 'accessories'
      ? (item.accessory_type_cd ?? 'etc')
      : item.slot_cd,
  );

// 썸네일 칸은 넷뿐이라, 넘치면 마지막 칸을 남은 개수 표시에 내주고 앞의 것을 보여 준다.
export const limitOutfitThumbnails = <Item>(items: readonly Item[]) => {
  const visibleCount =
    items.length > THUMBNAIL_CELL_COUNT
      ? THUMBNAIL_CELL_COUNT - 1
      : items.length;

  return {
    visibleItems: items.slice(0, visibleCount),
    hiddenCount: items.length - visibleCount,
  };
};

export const getOutfitThumbnails = <Item extends ThumbnailItem>(
  items: readonly Item[],
) =>
  limitOutfitThumbnails(
    [...items].sort(
      (left, right) => getThumbnailRank(left) - getThumbnailRank(right),
    ),
  );
