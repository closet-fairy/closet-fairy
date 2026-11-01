import SkeletonText from '@/components/common/SkeletonText';
import * as ThumbnailsS from '@/components/OutfitThumbnails/OutfitThumbnails.styled';
import { typography } from '@/styles/tokens';
import * as CardS from '../HistoryCard/HistoryCard.styled';
import * as S from './HistoryCardSkeleton.styled';

const CARD_DELAY_MS = 140;
const THUMBNAIL_COUNT = 4;

interface HistoryCardSkeletonProps {
  index: number;
}

const HistoryCardSkeleton = (props: HistoryCardSkeletonProps) => {
  const { index } = props;

  return (
    <S.Container delay={index * CARD_DELAY_MS}>
      <CardS.Summary>
        <CardS.Heading>
          <S.Title>
            <SkeletonText textStyle={typography.body1Strong} width="44%" />
          </S.Title>
          <CardS.Rating>
            <S.RatingText textStyle={typography.caption1Strong} />
          </CardS.Rating>
        </CardS.Heading>
        <CardS.Times>
          <SkeletonText textStyle={typography.label1} width="58%" />
          <SkeletonText textStyle={typography.label1} width="74%" />
        </CardS.Times>
      </CardS.Summary>
      <ThumbnailsS.Container>
        {Array.from({ length: THUMBNAIL_COUNT }, (_, thumbnailIndex) => (
          <S.Thumbnail key={thumbnailIndex} tone="light" />
        ))}
      </ThumbnailsS.Container>
      <SkeletonText textStyle={typography.caption1} width="48%" />
    </S.Container>
  );
};

export default HistoryCardSkeleton;
