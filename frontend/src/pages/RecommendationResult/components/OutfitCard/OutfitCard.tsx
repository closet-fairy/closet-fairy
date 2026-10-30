import Tag from '@/components/common/Tag';
import { getStyleLabel } from '@/domains/member/memberSettingOptions';
import { getOutfitStyleTags } from '@/domains/recommendation/outfitStyleTags';
import type { OutfitItemResult } from '@/generated/models';
import OutfitFloor from '@/pages/RecommendationResult/components/OutfitFloor';
import * as S from './OutfitCard.styled';

interface OutfitCardProps {
  items: readonly OutfitItemResult[];
}

const OutfitCard = (props: OutfitCardProps) => {
  const { items } = props;
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
    </S.Card>
  );
};

export default OutfitCard;
