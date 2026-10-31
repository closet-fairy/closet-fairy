import type { OutfitItemResult } from '@/generated/models';
import { getFloorItemKind } from './floorLayout';

type FloorCandidateSource = Pick<
  OutfitItemResult,
  'slot_cd' | 'accessory_type_cd' | 'item_name' | 'image_url'
>;

export const getFloorCandidates = (items: readonly FloorCandidateSource[]) =>
  items.flatMap((item, index) =>
    item.image_url !== null
      ? [
          {
            id: String(index),
            kind: getFloorItemKind(item),
            name: item.item_name,
            imageUrl: item.image_url,
          },
        ]
      : [],
  );

export const hasFloorCandidates = (items: readonly FloorCandidateSource[]) =>
  getFloorCandidates(items).length > 0;
