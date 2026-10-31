import styled from '@emotion/styled';
import { bg, fg, radius, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[12]};
  padding: ${spacing[14]};
  border-radius: ${radius.md};
  background-color: ${bg.neutral.light};
  color: ${fg.neutral.strong};
`;

export const Text = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[2]};
  min-width: 0;
`;

export const Heading = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
`;

export const Label = styled.span`
  ${typography.body2Strong}
`;

export const Details = styled.span`
  ${typography.label1}
  color: ${fg.neutral.light};
`;
