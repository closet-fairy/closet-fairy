import Skeleton from '@/components/common/Skeleton';
import SkeletonText from '@/components/common/SkeletonText';
import { typography } from '@/styles/tokens';
import * as S from './ClothingTotalCount.styled';

const SKELETON_WIDTH = '52px';

interface ClothingTotalCountProps {
  count: number | null;
}

const ClothingTotalCount = (props: ClothingTotalCountProps) => {
  const { count } = props;

  if (count === null) {
    return (
      <Skeleton>
        <SkeletonText textStyle={typography.body3} width={SKELETON_WIDTH} />
      </Skeleton>
    );
  }

  return <S.Count>{`총 ${count.toLocaleString('ko-KR')}벌`}</S.Count>;
};

export default ClothingTotalCount;
