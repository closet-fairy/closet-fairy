import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import BottomTabBar from './BottomTabBar';

const TAB_PATHS = [
  '/closet',
  '/recommendation',
  '/recommendation-history',
  '/my-info',
];

const renderTabBar = async (queryClient: QueryClient) => {
  const rootRoute = createRootRoute({ component: BottomTabBar });
  const router = createRouter({
    routeTree: rootRoute.addChildren(
      TAB_PATHS.map((path) =>
        createRoute({ getParentRoute: () => rootRoute, path }),
      ),
    ),
    history: createMemoryHistory({ initialEntries: ['/closet'] }),
  });
  const preloadRoute = vi
    .spyOn(router, 'preloadRoute')
    .mockResolvedValue(undefined);

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('navigation', { name: '주요 메뉴' });

  return { preloadRoute };
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

test('첫 화면이 자리 잡은 뒤에 탭 4개의 라우트를 미리 받아야 한다.', async () => {
  const { preloadRoute } = await renderTabBar(new QueryClient());

  expect(preloadRoute).not.toHaveBeenCalled();

  await act(() => vi.advanceTimersByTimeAsync(1100));

  expect(preloadRoute.mock.calls.map(([options]) => options.to)).toEqual(
    expect.arrayContaining(TAB_PATHS),
  );
  expect(preloadRoute).toHaveBeenCalledTimes(TAB_PATHS.length);
});

test('요청이 진행 중인 동안에는 미리 받지 않아야 한다.', async () => {
  const queryClient = new QueryClient();
  const { preloadRoute } = await renderTabBar(queryClient);

  const pending = queryClient.fetchQuery({
    queryKey: ['first-screen'],
    queryFn: () =>
      new Promise((resolve) => setTimeout(() => resolve('data'), 2500)),
  });
  await act(() => vi.advanceTimersByTimeAsync(2100));

  expect(preloadRoute).not.toHaveBeenCalled();

  await act(() => vi.advanceTimersByTimeAsync(500));
  await pending;
  await act(() => vi.advanceTimersByTimeAsync(1100));

  expect(preloadRoute).toHaveBeenCalledTimes(TAB_PATHS.length);
});

test('사진을 받는 중에는 미리 받지 않아야 한다.', async () => {
  const { preloadRoute } = await renderTabBar(new QueryClient());
  const image = document.createElement('img');
  Object.defineProperty(image, 'complete', { value: false });
  document.body.appendChild(image);

  await act(() => vi.advanceTimersByTimeAsync(2100));

  expect(preloadRoute).not.toHaveBeenCalled();

  image.remove();
  await act(() => vi.advanceTimersByTimeAsync(1100));

  expect(preloadRoute).toHaveBeenCalledTimes(TAB_PATHS.length);
});

test('요청이 끝나지 않아도 확인을 5번 하면 미리 받아야 한다.', async () => {
  const queryClient = new QueryClient();
  const { preloadRoute } = await renderTabBar(queryClient);

  void queryClient.fetchQuery({
    queryKey: ['polling'],
    queryFn: () => new Promise(() => undefined),
  });
  await act(() => vi.advanceTimersByTimeAsync(4100));

  expect(preloadRoute).not.toHaveBeenCalled();

  await act(() => vi.advanceTimersByTimeAsync(1000));

  expect(preloadRoute).toHaveBeenCalledTimes(TAB_PATHS.length);
});
