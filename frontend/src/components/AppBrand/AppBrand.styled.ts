import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

const LOGO_SIZE = 96;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[32]};
`;

export const LogoPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${LOGO_SIZE}px;
  height: ${LOGO_SIZE}px;
  border: 1px dashed ${border.neutral.dashed};
  border-radius: ${radius.xl};
  background-color: ${bg.neutral.pale};
  color: ${fg.neutral.pale};
`;

export const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
  text-align: center;
`;

export const Name = styled.h1`
  ${typography.title1}
  color: ${fg.neutral.strong};
`;

export const Tagline = styled.p`
  ${typography.body3}
  color: ${fg.neutral.light};
`;
