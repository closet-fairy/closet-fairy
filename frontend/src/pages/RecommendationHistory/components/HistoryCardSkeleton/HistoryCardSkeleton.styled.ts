import styled from '@emotion/styled';
import Skeleton from '@/components/common/Skeleton';
import SkeletonBlock from '@/components/common/SkeletonBlock';
import SkeletonText from '@/components/common/SkeletonText';
import { CELL_HEIGHT } from '@/components/OutfitItemImage/OutfitItemImage.constants';
import { cardBox } from '../HistoryCard/HistoryCard.styled';

const RATING_WIDTH = '28px';

export const Container = styled(Skeleton)`
  ${cardBox}
`;

export const Title = styled.div`
  flex: 1;
  min-width: 0;
`;

export const RatingText = styled(SkeletonText)`
  width: ${RATING_WIDTH};
`;

export const Thumbnail = styled(SkeletonBlock)`
  height: ${CELL_HEIGHT.sm};
`;
