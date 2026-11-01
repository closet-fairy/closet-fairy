import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

export const cardBox = css`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]};
  padding: ${spacing[14]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
  background-color: ${bg.white};
`;

export const Container = styled.article`
  ${cardBox}
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

export const Rating = styled.div`
  display: flex;
  flex: none;
  padding-top: ${spacing[2]};
`;

export const Times = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
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
