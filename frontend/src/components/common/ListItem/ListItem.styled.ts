import type { SerializedStyles } from '@emotion/react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
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
import type { ListItemVariant } from './ListItem';

const VARIANT_STYLE: Record<ListItemVariant, SerializedStyles> = {
  plain: css`
    padding: ${spacing[16]} ${spacing[2]};
    border-bottom: 1px solid ${border.neutral.soft};
  `,
  card: css`
    padding: ${spacing[16]} ${spacing[14]};
    border: 1px solid ${border.neutral.default};
    border-radius: ${radius.md};
  `,
};

const baseStyle = css`
  display: flex;
  align-items: center;
  gap: ${spacing[12]};
  width: 100%;
  color: ${fg.neutral.strong};
`;

export const Container = styled.div<{
  $variant: ListItemVariant;
  $isDisabled: boolean;
}>`
  ${baseStyle}
  ${({ $variant }) => VARIANT_STYLE[$variant]}
  ${({ $isDisabled }) =>
    $isDisabled &&
    css`
      opacity: ${opacity.disabled};
    `}
`;

export const ButtonContainer = styled.button<{ $variant: ListItemVariant }>`
  ${baseStyle}
  ${({ $variant }) => VARIANT_STYLE[$variant]}
  text-align: left;
  transition: background-color ${duration.fast} ${easing.standard};

  &:disabled {
    opacity: ${opacity.disabled};
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background-color: ${bg.neutral.pale};
    }
  }
`;

export const LeadingIcon = styled.span<{ $variant: ListItemVariant }>`
  display: flex;
  flex: none;
  color: ${({ $variant }) =>
    $variant === 'card' ? fg.neutral.strong : fg.neutral.pale};
`;

export const Text = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[2]};
  min-width: 0;
`;

export const Title = styled.span<{ $variant: ListItemVariant }>`
  ${({ $variant }) =>
    $variant === 'card' ? typography.body2Strong : typography.body2}
  color: ${fg.neutral.strong};
`;

export const Description = styled.span`
  ${typography.caption1}
  color: ${fg.neutral.light};
`;

export const Chevron = styled.span`
  display: flex;
  flex: none;
  color: ${fg.neutral.pale};
`;
