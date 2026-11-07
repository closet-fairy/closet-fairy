import styled from '@emotion/styled';
import { LOGIN_ACTIONS_HEIGHT } from '@/constants/loginActionsHeight';
import { spacing } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: env(safe-area-inset-top, 0px) ${spacing[32]}
    calc(env(safe-area-inset-bottom, 0px) + ${LOGIN_ACTIONS_HEIGHT}px);
`;
