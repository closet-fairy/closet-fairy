import styled from '@emotion/styled';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  spacing,
  typography,
} from '@/styles/tokens';

export const List = styled.ul`
  display: flex;
  flex-direction: column;
`;

export const Option = styled.li<{ $isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${spacing[12]};
  padding: ${spacing[14]} ${spacing[2]};
  border-bottom: 1px solid ${border.neutral.soft};
  color: ${fg.neutral.strong};
  cursor: pointer;
  transition: background-color ${duration.fast} ${easing.standard};

  ${({ $isSelected }) =>
    $isSelected ? typography.body1Strong : typography.body1}

  &:last-of-type {
    border-bottom: none;
  }

  @media (hover: hover) {
    &:hover {
      background-color: ${bg.neutral.pale};
    }
  }
`;

export const OptionLabel = styled.span`
  flex: 1;
  min-width: 0;
`;
