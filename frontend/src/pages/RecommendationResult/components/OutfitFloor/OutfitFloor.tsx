import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import type { OutfitItemResult } from '@/generated/models';
import useFloorImages from '@/pages/RecommendationResult/hooks/useFloorImages';
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

const getFloorCandidates = (items: readonly OutfitItemResult[]) =>
  items.flatMap((item) => {
    const slot = getFloorSlot(item);

    return slot !== null && item.image_url !== null
      ? [{ slot, name: item.item_name, imageUrl: item.image_url }]
      : [];
  });

const EMPTY_NOTICE: Record<
  'noImage' | 'loadFailed',
  { icon: IconName; title: string }
> = {
  noImage: { icon: 'image', title: '이 코디는 미리보기를 지원하지 않아요' },
  loadFailed: { icon: 'hide_image', title: '사진을 불러오지 못했어요' },
};

// 배치 방식이 정해지기 전의 임시 구현이다. 네 자리에 놓을 수 있는 옷만 놓고, 나머지는 서랍에서 보여 준다.
const OutfitFloor = (props: OutfitFloorProps) => {
  const { items } = props;
  const candidates = getFloorCandidates(items);
  const { isSettled, isSlow, isLoaded, markResult } = useFloorImages(
    candidates.map(({ imageUrl }) => imageUrl),
  );

  const placedItems = FLOOR_SLOTS.flatMap((slot) =>
    candidates
      .filter(
        (candidate) => candidate.slot === slot && isLoaded(candidate.imageUrl),
      )
      .slice(0, 1),
  );

  if (isSettled && placedItems.length === 0) {
    const notice =
      EMPTY_NOTICE[candidates.length > 0 ? 'loadFailed' : 'noImage'];

    return (
      <S.Empty>
        <S.EmptyIcon>
          <Icon name={notice.icon} size="xl" />
        </S.EmptyIcon>
        <S.EmptyTitle>{notice.title}</S.EmptyTitle>
        <S.EmptyDescription>
          정보 확인에서 아이템을 볼 수 있어요.
        </S.EmptyDescription>
      </S.Empty>
    );
  }

  return (
    <>
      {!isSettled && isSlow && (
        <S.Waiting role="status">
          <Icon name="progress_activity" size="lg" />
        </S.Waiting>
      )}
      <S.Stage>
        {/* 결과를 받으려고 먼저 그려 두고, 정해지면 놓을 옷만 남겨 같은 사진을 다시 불러오지 않게 한다. */}
        {(isSettled ? placedItems : candidates).map(
          ({ slot, name, imageUrl }) => (
            <S.Item
              key={`${slot}-${imageUrl}`}
              src={imageUrl}
              alt={name}
              draggable={false}
              $slot={slot}
              $isHidden={!isSettled}
              onLoad={() => markResult(imageUrl, 'loaded')}
              onError={() => markResult(imageUrl, 'failed')}
            />
          ),
        )}
      </S.Stage>
    </>
  );
};

export default OutfitFloor;
