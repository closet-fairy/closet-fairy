import styled from '@emotion/styled';
import {
  CHEVRON_SIZE,
  LABEL_WIDTH,
  ROW_MIN_HEIGHT,
} from '@/components/common/AccordionItem/AccordionItem.constants';
import SkeletonBlock from '@/components/common/SkeletonBlock';
import SkeletonText from '@/components/common/SkeletonText';
import { FIELD_HEIGHT } from '@/components/common/TextField/TextField.constants';
import { border, radius, spacing } from '@/styles/tokens';
import { imageBoxShape } from '../../ClothingDetailPage.styled';

export const Image = styled(SkeletonBlock)`
  ${imageBoxShape}
`;

export const NameInput = styled(SkeletonBlock)`
  height: ${FIELD_HEIGHT}px;
  border-radius: ${radius.md};
`;

export const AttributeRow = styled.div`
  border-bottom: 1px solid ${border.neutral.soft};
`;

export const AttributeTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[12]};
  min-height: ${ROW_MIN_HEIGHT}px;
`;

export const AttributeLabel = styled.div`
  flex: none;
  width: ${LABEL_WIDTH}px;
`;

export const AttributeSummary = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
`;

export const AttributeSummaryText = styled(SkeletonText)`
  justify-content: flex-end;
`;

export const AttributeChevron = styled.div`
  flex: none;
  width: ${CHEVRON_SIZE}px;
`;
