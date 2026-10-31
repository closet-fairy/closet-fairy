import { Drawer } from '@base-ui/react/drawer';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import {
  appFrame,
  bg,
  duration,
  easing,
  fg,
  radius,
  shadow,
  spacing,
  typography,
  zIndex,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';
import { visuallyHidden } from '@/styles/visuallyHidden';

const HANDLE_WIDTH = 38;
const HANDLE_HEIGHT = 4;
const SHEET_BLEED = 48;

export const Backdrop = styled(Drawer.Backdrop, transientOptions)`
  position: fixed;
  inset: 0;
  z-index: ${zIndex.modal};
  min-height: 100dvh;
  background-color: ${bg.dim};
  opacity: calc(1 - var(--drawer-swipe-progress, 0));
  transition: opacity ${duration.slow} ${easing.standard};

  @supports (-webkit-touch-callout: none) {
    position: absolute;
  }

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
  }

  &[data-swiping] {
    transition-duration: 0ms;
  }

  &[data-ending-style] {
    transition-duration: calc(
      var(--drawer-swipe-strength, 1) * ${duration.slow}
    );
  }
`;

export const Viewport = styled(Drawer.Viewport, transientOptions)`
  position: fixed;
  inset: 0;
  z-index: ${zIndex.modal};
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-top: ${spacing[40]};
  padding-bottom: var(--drawer-keyboard-inset, 0px);
  touch-action: none;
`;

export const Popup = styled(Drawer.Popup, transientOptions)<{
  $maxHeight?: string;
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-self: center;
  width: 100%;
  max-width: ${appFrame.maxWidth};
  max-height: ${({ $maxHeight }) => $maxHeight ?? '100%'};
  padding-bottom: calc(${spacing[20]} + env(safe-area-inset-bottom, 0px));
  border-radius: ${radius.xl} ${radius.xl} 0 0;
  background-color: ${bg.white};
  box-shadow: ${shadow.sheet};
  touch-action: none;
  transform: translateY(var(--drawer-swipe-movement-y, 0px));
  transition: transform ${duration.slow} ${easing.standard};
  will-change: transform;

  &:focus-visible {
    outline: none;
  }

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    height: ${SHEET_BLEED}px;
    background-color: ${bg.white};
    pointer-events: none;
  }

  &[data-swiping] {
    transition-duration: 0ms;
    user-select: none;
  }

  &[data-starting-style],
  &[data-ending-style] {
    transform: translateY(100%);
  }

  &[data-ending-style] {
    transition-duration: calc(
      var(--drawer-swipe-strength, 1) * ${duration.slow}
    );
  }
`;

export const Header = styled.div`
  flex: none;
  padding: ${spacing[12]} ${spacing[20]} 0;
`;

export const Handle = styled.div<{
  $isHidden: boolean;
  $isTitleHidden: boolean;
}>`
  width: ${HANDLE_WIDTH}px;
  height: ${HANDLE_HEIGHT}px;
  margin: 0 auto ${({ $isTitleHidden }) => ($isTitleHidden ? 0 : spacing[16])};
  border-radius: ${radius.full};
  background-color: ${bg.neutral.default};
  visibility: ${({ $isHidden }) => ($isHidden ? 'hidden' : 'visible')};
`;

export const Title = styled(Drawer.Title, transientOptions)<{
  $isHidden: boolean;
}>`
  ${typography.title3}
  color: ${fg.neutral.strong};

  ${({ $isHidden }) =>
    $isHidden &&
    css`
      ${visuallyHidden}
    `}
`;

export const Description = styled(Drawer.Description, transientOptions)`
  ${typography.label1}
  margin-top: ${spacing[4]};
  color: ${fg.neutral.light};
`;

export const Content = styled(Drawer.Content, transientOptions)`
  flex: 1 1 auto;
  min-height: 0;
  padding: ${spacing[16]} ${spacing[20]} ${spacing[4]};
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: auto;
`;

export const Footer = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
  padding: ${spacing[14]} ${spacing[20]} 0;
`;
