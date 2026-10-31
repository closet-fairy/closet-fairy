import Icon from '@/components/common/Icon';
import Tag from '@/components/common/Tag';
import { getStyleLabel } from '@/domains/member/memberSettingOptions';
import type { FloorSeed } from '@/domains/recommendation/floorLayout';
import { getOutfitStyleTags } from '@/domains/recommendation/outfitStyleTags';
import type { OutfitItemResult } from '@/generated/models';
import OutfitFloor from '@/pages/RecommendationResult/components/OutfitFloor';
import * as S from './OutfitCard.styled';

interface OutfitCardProps {
  items: readonly OutfitItemResult[];
  floorSeed: FloorSeed;
  isRegenerating?: boolean;
  isLifted?: boolean;
  previousCount?: number;
  recommendationOrder?: number;
  onOverflowClick?: () => void;
}

const OutfitCard = (props: OutfitCardProps) => {
  const {
    items,
    floorSeed,
    isRegenerating = false,
    isLifted = false,
    previousCount = 0,
    recommendationOrder,
    onOverflowClick,
  } = props;
  const styleCds = getOutfitStyleTags(items);
  const isPrevious = recommendationOrder !== undefined;

  return (
    <S.Card $isPrevious={isPrevious} $isLifted={isLifted}>
      <OutfitFloor
        items={items}
        seed={floorSeed}
        isOverflowDisabled={isRegenerating}
        onOverflowClick={onOverflowClick}
      />
      {isPrevious && (
        <S.Badge>
          <Tag variant="inverse" size="sm" icon="layers">
            {recommendationOrder}번째 추천
          </Tag>
        </S.Badge>
      )}
      {!isPrevious && previousCount > 0 && (
        <S.Badge>
          <Tag variant="white" size="sm" icon="layers">
            이전 코디 {previousCount}
          </Tag>
        </S.Badge>
      )}
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
