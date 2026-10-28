import { Toggle } from '@base-ui/react/toggle';
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
import { transientOptions } from '@/styles/transientOptions';
import type { ChipVariant } from './Chip';

const CHIP_HEIGHT = 36;

export const Container = styled(Toggle, transientOptions)<{
  $variant: ChipVariant;
  $hasTrailingIcon: boolean;
  $hasLeading: boolean;
}>`
  ${typography.body3}
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: ${spacing[4]};
  max-width: 100%;
  height: ${CHIP_HEIGHT}px;
  padding: 0
    ${({ $hasTrailingIcon }) => ($hasTrailingIcon ? spacing[12] : spacing[14])}
    0 ${({ $hasLeading }) => ($hasLeading ? spacing[10] : spacing[14])};
  border-width: 1px;
  border-style: ${({ $variant }) => ($variant === 'dashed' ? 'dashed' : 'solid')};
  border-color: ${({ $variant }) =>
    $variant === 'dashed' ? border.neutral.dashed : border.neutral.default};
  border-radius: ${radius.full};
  background-color: ${bg.white};
  color: ${fg.neutral.default};
  transition:
    background-color ${duration.fast} ${easing.standard},
    border-color ${duration.fast} ${easing.standard},
    color ${duration.fast} ${easing.standard};

  @media (hover: hover) {
    &:hover:not([data-pressed], [data-disabled]) {
      background-color: ${bg.neutral.light};
    }
  }

  &[data-pressed] {
    ${typography.body3Strong}
    border-style: solid;
    border-color: ${border.neutral.strong};
    background-color: ${bg.neutral.strong};
    color: ${fg.white};
  }

  &[data-disabled] {
    opacity: ${opacity.disabled};
  }
`;

export const Label = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const TrailingIcon = styled.span`
  display: inline-flex;
  flex: none;
  color: ${fg.neutral.light};

  [data-pressed] > & {
    color: inherit;
  }
`;

export const Leading = styled.span`
  display: flex;
  flex: none;
  align-items: center;
`;
