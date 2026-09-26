import { Global } from '@emotion/react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { globalStyles } from '@/styles/globalStyles';

const RootLayout = () => {
  return (
    <>
      <Global styles={globalStyles} />
      <Outlet />
      <ReactQueryDevtools />
      <TanStackRouterDevtools />
    </>
  );
};

export default RootLayout;
