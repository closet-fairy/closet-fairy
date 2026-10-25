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

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: ${bg.white};
`;

export const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[24]};
  min-height: 0;
  overflow-y: auto;
  padding: ${spacing[8]} ${spacing[20]} ${spacing[24]};
`;

export const StyleButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing[10]};
  width: 100%;
  padding: ${spacing[14]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
  background-color: ${bg.white};
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

export const StyleTags = styled.span`
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: ${spacing[6]};
  min-width: 0;
`;

export const StylePlaceholder = styled.span`
  ${typography.body3}
  color: ${fg.neutral.pale};
`;

export const Chevron = styled.span`
  display: flex;
  flex: none;
  color: ${fg.neutral.pale};
`;

export const Footer = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${spacing[8]};
  padding: ${spacing[14]} ${spacing[20]}
    calc(${spacing[18]} + env(safe-area-inset-bottom, 0px));
  background-color: ${bg.white};
`;

export const ErrorMessage = styled.p`
  ${typography.label1}
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  color: ${fg.error.default};
`;
