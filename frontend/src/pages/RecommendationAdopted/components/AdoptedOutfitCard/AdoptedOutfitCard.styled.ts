import styled from '@emotion/styled';
import { border, fg, radius, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  padding: ${spacing[14]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
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
