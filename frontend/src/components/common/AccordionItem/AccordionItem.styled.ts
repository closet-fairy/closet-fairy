import { Accordion } from '@base-ui/react/accordion';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import {
  border,
  duration,
  easing,
  fg,
  opacity,
  spacing,
  typography,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

const ROW_MIN_HEIGHT = 56;
const LABEL_WIDTH = 76;

export const Item = styled(Accordion.Item, transientOptions)`
  border-bottom: 1px solid ${border.neutral.soft};

  &[data-disabled] {
    opacity: ${opacity.disabled};
  }
`;

export const Header = styled(Accordion.Header, transientOptions)`
  margin: 0;
`;

export const Trigger = styled(Accordion.Trigger, transientOptions)`
  display: flex;
  align-items: center;
  gap: ${spacing[12]};
  width: 100%;
  min-height: ${ROW_MIN_HEIGHT}px;
  text-align: left;

  &:focus-visible {
    outline: 2px solid ${border.neutral.strong};
    outline-offset: -2px;
  }
`;

export const Label = styled.span`
  ${typography.body2}
  flex: none;
  width: ${LABEL_WIDTH}px;
  color: ${fg.neutral.light};
`;

export const Summary = styled.span<{ $isEmpty: boolean }>`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: ${spacing[6]};
  min-width: 0;

  ${({ $isEmpty }) =>
    $isEmpty
      ? css`
          ${typography.body2}
          color: ${fg.neutral.pale};
        `
      : css`
          ${typography.body2Strong}
          color: ${fg.neutral.strong};
        `}
`;

export const SummaryText = styled.span`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Chevron = styled.span`
  display: flex;
  flex: none;
  color: ${fg.neutral.pale};
  transition: transform ${duration.normal} ${easing.standard};

  [data-panel-open] > & {
    transform: rotate(180deg);
  }
`;

export const Panel = styled(Accordion.Panel, transientOptions)`
  height: var(--accordion-panel-height);
  overflow: hidden;
  transition: height ${duration.normal} ${easing.standard};

  &[data-starting-style],
  &[data-ending-style] {
    height: 0;
  }
`;

export const PanelContent = styled.div`
  padding-bottom: ${spacing[16]};
`;

export const ErrorMessage = styled.p`
  ${typography.caption1}
  padding-bottom: ${spacing[12]};
  color: ${fg.error.default};
`;
