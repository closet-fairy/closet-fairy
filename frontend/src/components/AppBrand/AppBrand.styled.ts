import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';
import { LOGO_HEIGHT } from './AppBrand.constants';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[28]};
`;

export const Logo = styled.img`
  flex: none;
  width: auto;
  height: ${LOGO_HEIGHT}px;
`;

export const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
  text-align: center;
`;

export const Name = styled.h1`
  ${typography.brandTitle}
  color: ${fg.white};
`;

export const Tagline = styled.p`
  ${typography.body1}
  color: ${fg.white};
`;
