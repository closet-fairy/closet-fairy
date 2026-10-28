import styled from '@emotion/styled';
import { border, fg, spacing, typography } from '@/styles/tokens';

export const List = styled.ul`
  display: flex;
  flex-direction: column;
`;

export const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
  padding: ${spacing[14]} 0;
  border-bottom: 1px solid ${border.neutral.soft};

  &:last-of-type {
    border-bottom: none;
  }
`;

export const FileName = styled.span`
  ${typography.body2}
  overflow-wrap: anywhere;
  color: ${fg.neutral.strong};
`;

export const Message = styled.span`
  ${typography.label1}
  color: ${fg.neutral.light};
`;
