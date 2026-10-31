import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

const THUMBNAIL_COLUMN_COUNT = 4;

export const Container = styled.div`
  padding: ${spacing[14]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
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

export const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
  margin-top: ${spacing[12]};
`;

export const Summary = styled.p`
  ${typography.caption1}
  min-width: 0;
  overflow: hidden;
  color: ${fg.neutral.light};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Rating = styled.div`
  display: flex;
  flex: none;
  margin-left: auto;
`;
