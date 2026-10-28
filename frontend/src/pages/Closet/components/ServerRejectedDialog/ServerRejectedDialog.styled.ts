import styled from '@emotion/styled';
import { bg, fg, radius, spacing, typography } from '@/styles/tokens';

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
`;

export const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
  padding: ${spacing[14]} ${spacing[16]};
  border-radius: ${radius.md};
  background-color: ${bg.neutral.light};
`;

export const FileName = styled.span`
  ${typography.body3Strong}
  overflow-wrap: anywhere;
  color: ${fg.neutral.strong};
`;

export const Message = styled.span`
  ${typography.label1}
  color: ${fg.neutral.light};
`;
