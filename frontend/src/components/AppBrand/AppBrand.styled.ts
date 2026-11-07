import styled from '@emotion/styled';
import { icons } from '@/assets/icons';
import { fg, spacing, typography } from '@/styles/tokens';

const LOGO_SIZE = 80;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[32]};
`;

export const Logo = styled(icons.checkroom)`
  flex: none;
  width: ${LOGO_SIZE}px;
  height: ${LOGO_SIZE}px;
  color: ${fg.white};
`;

export const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
  text-align: center;
`;

export const Name = styled.h1`
  ${typography.title1}
  color: ${fg.white};
`;

export const Tagline = styled.p`
  ${typography.body3}
  color: ${fg.white};
`;
