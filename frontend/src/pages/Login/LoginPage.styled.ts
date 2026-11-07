import styled from '@emotion/styled';
import {
  LOGIN_ACTIONS_BOTTOM_PADDING,
  LOGIN_ACTIONS_GAP,
  LOGIN_ACTIONS_HEIGHT,
} from '@/constants/loginActions';
import { spacing } from '@/styles/tokens';

export const Container = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
`;

export const Banner = styled.div`
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + ${spacing[20]});
  right: ${spacing[20]};
  left: ${spacing[20]};
`;

export const Brand = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 0 ${spacing[32]};
`;

export const Actions = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${LOGIN_ACTIONS_GAP};
  min-height: ${LOGIN_ACTIONS_HEIGHT};
  padding: 0 ${spacing[24]} ${LOGIN_ACTIONS_BOTTOM_PADDING};
`;
