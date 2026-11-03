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
    <S.Container>
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
      </S.Card>
      {isRegenerating && (
        <S.Fog role="status">
          <S.Spinner>
            <Icon name="progress_activity" size="xl" />
          </S.Spinner>
          <S.FogTitle>요청을 반영하는 중이에요</S.FogTitle>
          <S.FogDescription>길게는 3분까지 걸려요</S.FogDescription>
        </S.Fog>
      )}
    </S.Container>
  );
};

export default OutfitCard;
