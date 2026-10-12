import { Dialog } from '@base-ui/react/dialog';
import styled from '@emotion/styled';
import {
  bg,
  duration,
  easing,
  fg,
  radius,
  spacing,
  typography,
  zIndex,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

const POPUP_MAX_WIDTH = 400;
const POPUP_HIDDEN_SCALE = 0.96;

export const Backdrop = styled(Dialog.Backdrop, transientOptions)`
  position: fixed;
  inset: 0;
  z-index: ${zIndex.modal};
  min-height: 100dvh;
  background-color: ${bg.dim};
  transition: opacity ${duration.normal} ${easing.standard};

  @supports (-webkit-touch-callout: none) {
    position: absolute;
  }

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
  }
`;

export const Viewport = styled(Dialog.Viewport, transientOptions)`
  position: fixed;
  inset: 0;
  z-index: ${zIndex.modal};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing[24]};
`;

export const Popup = styled(Dialog.Popup, transientOptions)`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: ${POPUP_MAX_WIDTH}px;
  max-height: 100%;
  padding: ${spacing[24]} ${spacing[20]} ${spacing[20]};
  border-radius: ${radius.lg};
  background-color: ${bg.white};
  text-align: center;
  transition:
    opacity ${duration.normal} ${easing.standard},
    transform ${duration.normal} ${easing.standard};

  &:focus-visible {
    outline: none;
  }

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: scale(${POPUP_HIDDEN_SCALE});
  }
`;

export const Title = styled(Dialog.Title, transientOptions)`
  ${typography.title2}
  flex: none;
  color: ${fg.neutral.strong};
`;

export const Description = styled(Dialog.Description, transientOptions)`
  ${typography.label1}
  flex: none;
  margin-top: ${spacing[6]};
  color: ${fg.neutral.light};
`;

export const Body = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  margin: ${spacing[16]} calc(-1 * ${spacing[4]}) 0;
  padding: ${spacing[4]};
  overflow-y: auto;
  overscroll-behavior: contain;
`;

export const Footer = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
  margin-top: ${spacing[24]};
`;
