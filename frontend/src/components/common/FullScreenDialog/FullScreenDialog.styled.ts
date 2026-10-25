import { Dialog } from '@base-ui/react/dialog';
import styled from '@emotion/styled';
import {
  bg,
  duration,
  easing,
  fg,
  spacing,
  typography,
  zIndex,
} from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

const TOP_BAR_HEIGHT = 54;
const POPUP_HIDDEN_OFFSET = 24;

export const Popup = styled(Dialog.Popup, transientOptions)`
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
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
  height: ${TOP_BAR_HEIGHT}px;
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

export const Body = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 ${spacing[20]};
  overflow-y: auto;
  overscroll-behavior: contain;
`;
