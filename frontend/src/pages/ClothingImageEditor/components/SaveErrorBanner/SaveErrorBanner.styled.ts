import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  flex: none;
  padding: ${spacing[10]} ${spacing[16]};
  border-bottom: 1px solid ${border.neutral.soft};
  background-color: ${bg.white};
`;

export const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[10]};
  padding: ${spacing[12]} ${spacing[12]} ${spacing[12]} ${spacing[14]};
  border-radius: ${radius.md};
  background-color: ${bg.error.light};
`;

export const IconWrapper = styled.span`
  display: inline-flex;
  flex: none;
  color: ${fg.error.default};
`;

export const Message = styled.p`
  ${typography.label1}
  flex: 1;
  min-width: 0;
  color: ${fg.neutral.default};
  overflow-wrap: anywhere;
`;
