import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
  min-width: 0;
`;

export const Lead = styled.span`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${spacing[6]};
  color: ${fg.neutral.light};
`;

export const Label = styled.span`
  ${typography.label1Strong}
`;

export const Value = styled.span`
  ${typography.label1}
  min-width: 0;
  overflow: hidden;
  color: ${fg.neutral.default};
  white-space: nowrap;
  text-overflow: ellipsis;
`;
