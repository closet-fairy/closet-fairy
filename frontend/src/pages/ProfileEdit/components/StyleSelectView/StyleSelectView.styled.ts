import styled from '@emotion/styled';
import { bg, border, fg, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: ${bg.white};
`;

export const Count = styled.span`
  ${typography.label1}
  color: ${fg.neutral.light};
`;

export const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 ${spacing[20]};
`;

export const Footer = styled.div`
  flex: none;
  padding: ${spacing[12]} ${spacing[20]}
    calc(${spacing[16]} + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid ${border.neutral.soft};
  background-color: ${bg.white};
`;
