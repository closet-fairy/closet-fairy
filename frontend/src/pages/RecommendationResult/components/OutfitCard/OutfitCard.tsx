import Icon from '@/components/common/Icon';
import Tag from '@/components/common/Tag';
import OutfitFloor from '@/components/OutfitFloor';
import { getStyleLabel } from '@/domains/member/memberSettingOptions';
import type { FloorSeed } from '@/domains/recommendation/floorLayout';
import { getOutfitStyleTags } from '@/domains/recommendation/outfitStyleTags';
import type { OutfitItemResult } from '@/generated/models';
import type { FloorEntranceOption } from '@/hooks/useFloorEntrance';
import * as S from './OutfitCard.styled';

interface OutfitCardProps {
  items: readonly OutfitItemResult[];
  floorSeed: FloorSeed;
  isRegenerating?: boolean;
  onOverflowClick?: () => void;
  entrance?: FloorEntranceOption;
}

const OutfitCard = (props: OutfitCardProps) => {
  const {
    items,
    floorSeed,
    isRegenerating = false,
    onOverflowClick,
    entrance,
  } = props;
  const styleCds = getOutfitStyleTags(items);

  return (
    <S.Card>
      <OutfitFloor
        items={items}
        seed={floorSeed}
        isOverflowDisabled={isRegenerating}
        onOverflowClick={onOverflowClick}
        entrance={entrance}
      />
      {styleCds.length > 0 && (
        <S.Tags>
          {styleCds.map((styleCd) => (
            <Tag key={styleCd} size="sm">
              {getStyleLabel(styleCd)}
            </Tag>
          ))}
        </S.Tags>
      )}
      {isRegenerating && (
        <S.Cover role="status">
          <S.Spinner>
            <Icon name="progress_activity" size="xl" />
          </S.Spinner>
          <S.CoverTitle>요청을 반영하는 중이에요</S.CoverTitle>
          <S.CoverDescription>길게는 3분까지 걸려요</S.CoverDescription>
        </S.Cover>
      )}
    </S.Card>
  );
};

export default OutfitCard;
