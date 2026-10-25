import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]};
`;

export const Placeholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[12]};
`;

export const Status = styled.p`
  ${typography.body3}
  color: ${fg.neutral.light};
  text-align: center;

  &:not(:empty) {
    padding-top: ${spacing[40]};
  }
`;

export const List = styled.ul`
  display: flex;
  flex-direction: column;
`;
