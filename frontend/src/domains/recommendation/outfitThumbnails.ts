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

// 썸네일 칸은 넷뿐이라, 넘치면 마지막 칸을 남은 개수 표시에 내주고 머리에서 발 순서로 앞의 것을 보여 준다.
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
