import styled from '@emotion/styled';
import { border, fg, radius, spacing, typography } from '@/styles/tokens';

const LABEL_WIDTH = 74;

export const Card = styled.dl`
  overflow: hidden;
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
`;

export const Row = styled.div<{ $isTopAligned?: boolean }>`
  display: flex;
  align-items: ${({ $isTopAligned = false }) =>
    $isTopAligned ? 'flex-start' : 'center'};
  gap: ${spacing[8]};
  padding: ${spacing[14]};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${border.neutral.soft};
  }
`;

export const Label = styled.dt`
  ${typography.body3}
  flex: none;
  width: ${LABEL_WIDTH}px;
  color: ${fg.neutral.light};
`;

export const Value = styled.dd`
  ${typography.body2}
  flex: 1;
  min-width: 0;
  color: ${fg.neutral.strong};
`;

export const Tags = styled.dd`
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: ${spacing[6]};
  min-width: 0;
`;
