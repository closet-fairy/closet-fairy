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

const MIN_TOUCH_SIZE = 44;
const NUMBER_SIZE = 20;

export const Nav = styled.nav`
  width: 100%;
`;

export const List = styled.ol<{ $isDisabled: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  ${({ $isDisabled }) =>
    $isDisabled &&
    css`
      opacity: ${opacity.disabled};
    `}
`;

export const Item = styled.li`
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
`;

export const Separator = styled.span`
  display: inline-flex;
  flex: none;
  color: ${fg.neutral.pale};
`;

export const Step = styled.button<{ $isCurrent: boolean }>`
  ${({ $isCurrent }) =>
    $isCurrent ? typography.body3Strong : typography.body3}
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: ${spacing[6]};
  min-width: 0;
  height: ${MIN_TOUCH_SIZE}px;
  border-radius: ${radius.sm};
  color: ${({ $isCurrent }) =>
    $isCurrent ? fg.neutral.strong : fg.neutral.light};
  transition: color ${duration.fast} ${easing.standard};

  &:focus-visible {
    outline: 2px solid ${border.neutral.strong};
    outline-offset: -2px;
  }
`;

export const Number = styled.span<{ $isCurrent: boolean }>`
  ${typography.caption2Strong}
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: ${NUMBER_SIZE}px;
  height: ${NUMBER_SIZE}px;
  border: 1px solid
    ${({ $isCurrent }) =>
      $isCurrent ? border.neutral.strong : border.neutral.default};
  border-radius: ${radius.full};
  background-color: ${({ $isCurrent }) =>
    $isCurrent ? bg.neutral.strong : 'transparent'};
  color: ${({ $isCurrent }) => ($isCurrent ? fg.white : fg.neutral.light)};
  line-height: 1;
`;

export const Label = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
