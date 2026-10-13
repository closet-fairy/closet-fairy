import { Global } from '@emotion/react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import BottomTabBar from '@/components/BottomTabBar';
import { globalStyles } from '@/styles/globalStyles';
import * as S from './RootLayout.styled';

const RootLayout = () => {
  return (
    <>
      <Global styles={globalStyles} />
      <S.Container>
        <S.Main>
          <Outlet />
        </S.Main>
        <BottomTabBar />
      </S.Container>
      <ReactQueryDevtools />
      <TanStackRouterDevtools />
    </>
  );
};

export default RootLayout;
