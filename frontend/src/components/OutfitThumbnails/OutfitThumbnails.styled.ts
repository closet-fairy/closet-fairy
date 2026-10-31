import styled from '@emotion/styled';
import { bg, fg, radius, spacing, typography } from '@/styles/tokens';

const COLUMN_COUNT = 4;

export const Container = styled.div`
  display: grid;
  grid-template-columns: repeat(${COLUMN_COUNT}, minmax(0, 1fr));
  gap: ${spacing[8]};
`;

export const HiddenCount = styled.span`
  ${typography.body3Strong}
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${radius.sm};
  background-color: ${bg.neutral.light};
  color: ${fg.neutral.soft};
`;
