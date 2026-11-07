import { Global } from '@emotion/react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import AuthGate from '@/components/AuthGate';
import BottomTabBar from '@/components/BottomTabBar';
import { BOTTOM_TAB_BAR_HEIGHT } from '@/components/BottomTabBar/BottomTabBar.styled';
import Toaster from '@/components/common/Toaster';
import ToastProvider from '@/components/common/ToastProvider';
import SessionExpiredDialog from '@/components/SessionExpiredDialog';
import useRouteStaticDataFlag from '@/hooks/useRouteStaticDataFlag';
import { globalStyles } from '@/styles/globalStyles';
import * as S from './RootLayout.styled';

const RootLayout = () => {
  const isFullScreen = useRouteStaticDataFlag('isFullScreen');

  return (
    <ToastProvider>
      <Global styles={globalStyles} />
      <S.Outside>
        <S.Container>
          <AuthGate>
            <S.Main>
              <Outlet />
            </S.Main>
            {!isFullScreen && <BottomTabBar />}
          </AuthGate>
        </S.Container>
      </S.Outside>
      <SessionExpiredDialog />
      <Toaster bottomOffset={isFullScreen ? 0 : BOTTOM_TAB_BAR_HEIGHT} />
      <ReactQueryDevtools />
      <TanStackRouterDevtools />
    </ToastProvider>
  );
};

export default RootLayout;
