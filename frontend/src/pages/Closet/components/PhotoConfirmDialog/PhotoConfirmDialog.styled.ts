import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]};
  padding: ${spacing[8]} ${spacing[20]} ${spacing[20]};
`;

export const Heading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${spacing[8]};
`;

export const HeadingTitle = styled.p`
  ${typography.label1Strong}
  color: ${fg.neutral.light};
`;

export const HeadingCount = styled.p<{ $isFull: boolean }>`
  ${({ $isFull }) => ($isFull ? typography.label1Strong : typography.caption1)}
  flex: none;
  color: ${({ $isFull }) => ($isFull ? fg.neutral.strong : fg.neutral.pale)};
`;

export const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${spacing[10]};
`;

export const Empty = styled.p`
  ${typography.body3}
  padding: ${spacing[40]} 0;
  color: ${fg.neutral.light};
  text-align: center;
`;
