import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface StoryRouterProviderProps {
  initialPath: string;
  children: ReactNode;
}

const StoryRouterProvider = (props: StoryRouterProviderProps) => {
  const { initialPath, children } = props;
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute(),
      history: createMemoryHistory({ initialEntries: [initialPath] }),
    }),
  );

  return (
    <RouterContextProvider router={router}>{children}</RouterContextProvider>
  );
};

export default StoryRouterProvider;
