import Skeleton from '@/components/common/Skeleton';
import SkeletonText from '@/components/common/SkeletonText';
import { typography } from '@/styles/tokens';
import * as CardS from '../ClothingCard/ClothingCard.styled';
import * as S from './ClothingCardSkeleton.styled';

const COLUMN_DELAY_MS = 90;
const NAME_WIDTHS = ['78%', '64%', '88%'];
const CATEGORY_WIDTHS = ['42%', '36%', '48%'];

interface ClothingCardSkeletonProps {
  column: number;
  row: number;
}

const ClothingCardSkeleton = (props: ClothingCardSkeletonProps) => {
  const { column, row } = props;

  return (
    <Skeleton delay={(column + row) * COLUMN_DELAY_MS}>
      <S.Photo tone="light" />
      <CardS.Caption>
        <SkeletonText
          textStyle={typography.label1}
          width={NAME_WIDTHS[column % NAME_WIDTHS.length]}
        />
        <SkeletonText
          textStyle={typography.caption1}
          width={CATEGORY_WIDTHS[column % CATEGORY_WIDTHS.length]}
        />
      </CardS.Caption>
    </Skeleton>
  );
};

export default ClothingCardSkeleton;
