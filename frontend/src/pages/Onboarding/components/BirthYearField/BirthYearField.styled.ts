import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
`;

export const Guide = styled.p`
  ${typography.caption1}
  color: ${fg.neutral.light};
`;

export const ErrorMessage = styled.p`
  ${typography.caption1}
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  color: ${fg.error.default};
`;
