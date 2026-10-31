import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

const GRID_COLUMN_COUNT = 4;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[14]};
`;

export const Shortage = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[10]};
  padding: ${spacing[12]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
`;

export const ShortageIcon = styled.span`
  display: flex;
  flex: none;
  color: ${fg.neutral.strong};
`;

export const ShortageText = styled.p`
  ${typography.label1Strong}
  flex: 1;
  min-width: 0;
  color: ${fg.neutral.strong};
`;

export const Tags = styled.div`
  display: flex;
  gap: ${spacing[6]};
`;

export const ItemGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(${GRID_COLUMN_COUNT}, minmax(0, 1fr));
  gap: ${spacing[8]};
`;

export const ItemName = styled.p<{ $isEssential: boolean }>`
  ${typography.caption2}
  margin-top: ${spacing[6]};
  overflow: hidden;
  color: ${({ $isEssential }) =>
    $isEssential ? fg.neutral.soft : fg.neutral.strong};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Weather = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]};
  padding: ${spacing[12]} ${spacing[14]};
  border-radius: ${radius.sm};
  background-color: ${bg.neutral.light};
`;

export const WeatherLine = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]};
  color: ${fg.neutral.strong};
`;

export const WeatherLabel = styled.span`
  ${typography.label1Strong}
`;

export const WeatherNotice = styled.p`
  ${typography.caption1}
  color: ${fg.neutral.light};
`;

export const ReasonHeading = styled.h2`
  ${typography.label1Strong}
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
  margin-bottom: ${spacing[6]};
  color: ${fg.neutral.strong};
`;

export const ReasonText = styled.p`
  ${typography.body3}
  color: ${fg.neutral.default};
`;
