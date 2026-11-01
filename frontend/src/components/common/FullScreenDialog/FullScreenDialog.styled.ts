import { Dialog } from '@base-ui/react/dialog';
import styled from '@emotion/styled';
import {
  appFrame,
  bg,
  border,
  duration,
  easing,
  fg,
  spacing,
  topBarHeight,
  typography,
  zIndex,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

const POPUP_HIDDEN_OFFSET = 24;

export const Popup = styled(Dialog.Popup, transientOptions)`
  position: fixed;
  top: 0;
  right: ${appFrame.sideInset};
  left: ${appFrame.sideInset};
  height: 100%;
  z-index: ${zIndex.modal};
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background-color: ${bg.white};
  transition:
    opacity ${duration.normal} ${easing.standard},
    transform ${duration.normal} ${easing.standard};

  &:focus-visible {
    outline: none;
  }

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: translateX(${POPUP_HIDDEN_OFFSET}px);
  }
`;

export const TopBar = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${spacing[4]};
  height: ${topBarHeight}px;
  padding: 0 ${spacing[20]} 0 ${spacing[8]};
`;

export const Title = styled(Dialog.Title, transientOptions)`
  ${typography.title3}
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: ${fg.neutral.strong};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Header = styled.div`
  flex: none;
  padding: ${spacing[6]} ${spacing[20]} ${spacing[14]};
`;

export const Footer = styled.div`
  flex: none;
  padding: ${spacing[14]} ${spacing[20]} ${spacing[16]};
  border-top: 1px solid ${border.neutral.soft};
`;

export const Body = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 ${spacing[20]};
  overflow-y: auto;
  overscroll-behavior: contain;
`;
