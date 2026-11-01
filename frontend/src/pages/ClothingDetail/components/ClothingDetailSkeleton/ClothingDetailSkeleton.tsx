import Skeleton from '@/components/common/Skeleton';
import SkeletonText from '@/components/common/SkeletonText';
import { typography } from '@/styles/tokens';
import * as NameFieldS from '../ClothingNameField/ClothingNameField.styled';
import * as S from './ClothingDetailSkeleton.styled';

const ATTRIBUTE_ROW_COUNT = 6;

const ClothingDetailSkeleton = () => (
  <Skeleton>
    <S.Image tone="light" />
    <NameFieldS.Row>
      <NameFieldS.Label as="div">
        <SkeletonText textStyle={typography.body2} width="70%" />
      </NameFieldS.Label>
      <NameFieldS.Field>
        <S.NameInput tone="light" />
      </NameFieldS.Field>
    </NameFieldS.Row>
    {Array.from({ length: ATTRIBUTE_ROW_COUNT }, (_, index) => (
      <S.AttributeRow key={index}>
        <S.AttributeTrigger>
          <S.AttributeLabel>
            <SkeletonText textStyle={typography.body2} width="70%" />
          </S.AttributeLabel>
          <S.AttributeSummary>
            <S.AttributeSummaryText textStyle={typography.body2} width="40%" />
          </S.AttributeSummary>
          <S.AttributeChevron />
        </S.AttributeTrigger>
      </S.AttributeRow>
    ))}
  </Skeleton>
);

export default ClothingDetailSkeleton;
