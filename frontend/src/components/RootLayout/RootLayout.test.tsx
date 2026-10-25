import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import RootLayout from './RootLayout';

const renderAt = (path: string) => {
  const rootRoute = createRootRoute({ component: RootLayout });
  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/closet',
      component: () => <p>옷장 화면</p>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/closet/$clothingId/edit',
      staticData: { isFullScreen: true },
      component: () => <p>편집 화면</p>,
    }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  render(<RouterProvider router={router} />);
};

describe('하단 탭 표시', () => {
  test('일반 화면에서는 하단 탭을 보여 줘야 한다.', async () => {
    renderAt('/closet');

    expect(await screen.findByText('옷장 화면')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: '주요 메뉴' }),
    ).toBeInTheDocument();
  });

  test('전체 화면으로 표시한 화면에서는 하단 탭을 그리지 않아야 한다.', async () => {
    renderAt('/closet/1/edit');

    expect(await screen.findByText('편집 화면')).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: '주요 메뉴' }),
    ).not.toBeInTheDocument();
  });
});
