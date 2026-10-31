import StarRating from '@/components/common/StarRating';
import EstimatedBadge from '@/components/EstimatedBadge';
import OutfitThumbnails from '@/components/OutfitThumbnails';
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
      <OutfitThumbnails items={visibleItems} hiddenCount={hiddenCount} />
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
