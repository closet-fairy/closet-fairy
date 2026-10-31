import StarRating from '@/components/common/StarRating';
import EstimatedBadge from '@/components/EstimatedBadge';
import OutfitItemImage from '@/components/OutfitItemImage';
import { getOutfitThumbnails } from '@/domains/recommendation/outfitThumbnails';
import type { RecommendationHistoryDetail } from '@/generated/models';
import * as S from './AdoptedOutfitCard.styled';

interface AdoptedOutfitCardProps {
  items: RecommendationHistoryDetail['outfit']['items'];
  summary: string;
  isWeatherEstimated?: boolean;
  rating: number;
}

const AdoptedOutfitCard = (props: AdoptedOutfitCardProps) => {
  const { items, summary, isWeatherEstimated = false, rating } = props;
  const { visibleItems, hiddenCount } = getOutfitThumbnails(items);

  return (
    <S.Container>
      <S.Thumbnails>
        {visibleItems.map((item, itemIndex) => (
          // 같은 옷이 두 번 올 수 없지만 고유 번호가 없어 이름과 순서로 구분한다.
          <OutfitItemImage
            key={`${item.item_name}-${itemIndex}`}
            item={item}
            size="sm"
          />
        ))}
        {hiddenCount > 0 && <S.HiddenCount>+{hiddenCount}</S.HiddenCount>}
      </S.Thumbnails>
      <S.Footer>
        <S.Summary>{summary}</S.Summary>
        {isWeatherEstimated && <EstimatedBadge />}
        <S.Rating>
          <StarRating value={rating} isReadOnly size="sm" />
        </S.Rating>
      </S.Footer>
    </S.Container>
  );
};

export default AdoptedOutfitCard;
