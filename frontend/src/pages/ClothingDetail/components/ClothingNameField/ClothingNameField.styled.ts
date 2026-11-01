import styled from '@emotion/styled';
import { LABEL_WIDTH } from '@/components/common/AccordionItem/AccordionItem.constants';
import { border, fg, spacing, typography } from '@/styles/tokens';

export const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[8]};
  padding: ${spacing[12]} 0;
  border-bottom: 1px solid ${border.neutral.soft};
`;

export const Label = styled.label`
  ${typography.body2}
  flex: none;
  width: ${LABEL_WIDTH}px;
  padding-top: ${spacing[12]};
  color: ${fg.neutral.light};
`;

export const Field = styled.div`
  flex: 1;
  min-width: 0;
`;
