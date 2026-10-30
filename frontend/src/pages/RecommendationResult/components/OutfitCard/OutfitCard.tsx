import Icon from '@/components/common/Icon';
import Tag from '@/components/common/Tag';
import { getStyleLabel } from '@/domains/member/memberSettingOptions';
import { getOutfitStyleTags } from '@/domains/recommendation/outfitStyleTags';
import type { OutfitItemResult } from '@/generated/models';
import OutfitFloor from '@/pages/RecommendationResult/components/OutfitFloor';
import * as S from './OutfitCard.styled';

interface OutfitCardProps {
  items: readonly OutfitItemResult[];
  isRegenerating?: boolean;
}

const OutfitCard = (props: OutfitCardProps) => {
  const { items, isRegenerating = false } = props;
  const styleCds = getOutfitStyleTags(items);

  return (
    <S.Card>
      <OutfitFloor items={items} />
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
