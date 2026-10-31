import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

const COLUMN_COUNT = 3;

export const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(${COLUMN_COUNT}, minmax(0, 1fr));
  gap: ${spacing[14]} ${spacing[8]};
`;

export const Name = styled.p<{ $isDeleted: boolean }>`
  ${typography.label1}
  margin-top: ${spacing[6]};
  overflow: hidden;
  color: ${({ $isDeleted }) =>
    $isDeleted ? fg.neutral.light : fg.neutral.strong};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Slot = styled.p`
  ${typography.caption1}
  color: ${fg.neutral.light};
`;
