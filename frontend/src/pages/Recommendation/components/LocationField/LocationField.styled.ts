import styled from '@emotion/styled';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';

export const Trigger = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing[10]};
  width: 100%;
  padding: ${spacing[16]} ${spacing[14]};
  border: 1px solid ${border.neutral.default};
  border-radius: ${radius.md};
  background-color: ${bg.white};
  color: ${fg.neutral.strong};
  text-align: left;
  transition: background-color ${duration.fast} ${easing.standard};

  @media (hover: hover) {
    &:hover {
      background-color: ${bg.neutral.pale};
    }
  }
`;

export const Content = styled.span`
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${spacing[8]};
  min-width: 0;
`;

export const Value = styled.span`
  ${typography.body2Strong}
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Placeholder = styled.span`
  ${typography.body2}
  flex: 1;
  color: ${fg.neutral.pale};
`;

export const Chevron = styled.span`
  display: flex;
  flex: none;
  color: ${fg.neutral.pale};
`;
