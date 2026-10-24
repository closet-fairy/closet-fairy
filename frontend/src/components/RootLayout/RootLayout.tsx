import { Global } from '@emotion/react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, useMatches } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import BottomTabBar from '@/components/BottomTabBar';
import { globalStyles } from '@/styles/globalStyles';
import * as S from './RootLayout.styled';

const RootLayout = () => {
  const isFullScreen = useMatches({
    select: (matches) =>
      matches.some(
        (match) =>
          match.staticData.isFullScreen === true &&
          // 주소가 잘못돼 찾을 수 없는 페이지를 보여 줄 때는 하단 탭으로 빠져나갈 수 있어야 한다.
          match.paramsError === undefined,
      ),
  });

  return (
    <>
      <Global styles={globalStyles} />
      <S.Container>
        <S.Main>
          <Outlet />
        </S.Main>
        {!isFullScreen && <BottomTabBar />}
      </S.Container>
      <ReactQueryDevtools />
      <TanStackRouterDevtools />
    </>
  );
};

export default RootLayout;
