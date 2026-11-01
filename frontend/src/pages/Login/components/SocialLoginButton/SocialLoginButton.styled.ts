import { css } from '@emotion/react';
import type { SerializedStyles } from '@emotion/react';
import styled from '@emotion/styled';
import type { ProviderCd } from '@/domains/member/memberSettingOptions';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  opacity,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';

const HEIGHT = 54;

const PRESSED_SCALE = 0.98;

const LOGO_SIZE: Record<ProviderCd, number> = {
  google: 20,
  kakao: 14,
};

const providerStyles: Record<ProviderCd, SerializedStyles> = {
  google: css`
    gap: ${spacing[10]};
    background-color: ${bg.white};
    color: ${fg.brand.google};
    box-shadow: inset 0 0 0 1px ${border.brand.google};
  `,
  kakao: css`
    gap: ${spacing[8]};
    background-color: ${bg.brand.kakao};
    color: ${fg.brand.kakao};
  `,
};

export const Button = styled.button<{ $provider: ProviderCd }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: ${HEIGHT}px;
  padding: ${spacing[8]} ${spacing[20]};
  border-radius: ${radius.md};
  text-align: center;
  transition: transform ${duration.fast} ${easing.standard};

  ${typography.body1Medium}
  ${({ $provider }) => providerStyles[$provider]}

  &:active:not(:disabled) {
    transform: scale(${PRESSED_SCALE});
  }

  &:disabled {
    opacity: ${opacity.disabled};
  }
`;

export const Logo = styled.img<{ $provider: ProviderCd }>`
  flex: none;
  width: ${({ $provider }) => LOGO_SIZE[$provider]}px;
  height: ${({ $provider }) => LOGO_SIZE[$provider]}px;
  object-fit: contain;
  pointer-events: none;
`;
