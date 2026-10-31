import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

const THUMBNAIL_COLUMN_COUNT = 4;

export const Container = styled.article`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]};
  padding: ${spacing[14]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
  background-color: ${bg.white};
`;

export const Summary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[6]};
`;

export const Heading = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[8]};
`;

export const Title = styled.h2`
  ${typography.body1Strong}
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: ${fg.neutral.strong};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Rating = styled.span`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${spacing[2]};
  padding-top: ${spacing[2]};
  color: ${fg.neutral.strong};
`;

export const RatingValue = styled.span`
  ${typography.label1Strong}
`;

export const Times = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
`;

export const Thumbnails = styled.div`
  display: grid;
  grid-template-columns: repeat(${THUMBNAIL_COLUMN_COUNT}, minmax(0, 1fr));
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

export const Weather = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
  color: ${fg.neutral.soft};
`;

export const WeatherLabel = styled.span`
  ${typography.caption1}
`;
