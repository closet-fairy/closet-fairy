import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import styled from '@emotion/styled';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  opacity,
  spacing,
  typography,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

export const Container = styled(ToggleGroup, transientOptions)`
  display: flex;
  flex-direction: column;
`;

export const Item = styled(Toggle, transientOptions)`
  display: flex;
  align-items: center;
  gap: ${spacing[12]};
  width: 100%;
  padding: ${spacing[12]} 0;
  border-bottom: 1px solid ${border.neutral.soft};
  background-color: transparent;
  text-align: left;
  transition: background-color ${duration.fast} ${easing.standard};

  @media (hover: hover) {
    &:hover:not([data-disabled]) {
      background-color: ${bg.neutral.pale};
    }
  }

  &[data-disabled] {
    opacity: ${opacity.disabled};
  }
`;

export const Text = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[2]};
  min-width: 0;
`;

export const Label = styled.span<{ $isChecked: boolean }>`
  ${({ $isChecked }) =>
    $isChecked ? typography.body2Strong : typography.body2}
  color: ${fg.neutral.strong};
`;

export const Description = styled.span`
  ${typography.label1}
  color: ${fg.neutral.light};
`;

export const Indicator = styled.span<{ $isChecked: boolean }>`
  display: flex;
  flex: none;
  color: ${({ $isChecked }) =>
    $isChecked ? fg.neutral.strong : fg.neutral.pale};
`;
