import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

export const Container = styled.span`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${spacing[4]};
  color: ${fg.neutral.default};
`;

export const Text = styled.span`
  ${typography.body3Strong}
  white-space: nowrap;
`;

export const Unavailable = styled.span`
  ${typography.label1}
  color: ${fg.neutral.light};
  white-space: nowrap;
`;
