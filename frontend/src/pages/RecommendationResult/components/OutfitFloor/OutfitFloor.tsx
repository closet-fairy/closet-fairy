import Icon from '@/components/common/Icon';
import type { OutfitItemResult } from '@/generated/models';
import * as S from './OutfitFloor.styled';

export type FloorSlot = 'hat' | 'top' | 'bottom' | 'shoes';

interface OutfitFloorProps {
  items: readonly OutfitItemResult[];
}

const FLOOR_SLOTS: readonly FloorSlot[] = ['hat', 'top', 'bottom', 'shoes'];

const getFloorSlot = (item: OutfitItemResult): FloorSlot | null => {
  const { slot_cd: slotCd, accessory_type_cd: accessoryTypeCd } = item;

  if (slotCd === 'accessories') {
    return accessoryTypeCd === 'hat' ? 'hat' : null;
  }

  return slotCd === 'top' || slotCd === 'bottom' || slotCd === 'shoes'
    ? slotCd
    : null;
};

// 배치 방식이 정해지기 전의 임시 구현이다. 네 자리에 놓을 수 있는 옷만 놓고, 나머지는 서랍에서 보여 준다.
const OutfitFloor = (props: OutfitFloorProps) => {
  const { items } = props;

  const placedItems = FLOOR_SLOTS.flatMap((slot) => {
    const item = items.find(
      (candidate) =>
        getFloorSlot(candidate) === slot &&
        candidate.item_source_cd === 'owned',
    );

    if (!item || item.image_url === null) {
      return [];
    }

    return [{ slot, name: item.item_name, imageUrl: item.image_url }];
  });

  if (placedItems.length === 0) {
    return (
      <S.Empty>
        <S.EmptyIcon>
          <Icon name="image" size="xl" />
        </S.EmptyIcon>
        <S.EmptyTitle>이 코디는 미리보기를 지원하지 않아요</S.EmptyTitle>
        <S.EmptyDescription>
          정보 확인에서 아이템을 볼 수 있어요.
        </S.EmptyDescription>
      </S.Empty>
    );
  }

  return (
    <S.Stage>
      {placedItems.map(({ slot, name, imageUrl }) => (
        <S.Item
          key={slot}
          src={imageUrl}
          alt={name}
          draggable={false}
          $slot={slot}
        />
      ))}
    </S.Stage>
  );
};

export default OutfitFloor;
