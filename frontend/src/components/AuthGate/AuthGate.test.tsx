import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { setMockMemberStatus } from '@/mocks/handlers/member';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const AUTH_REQUIRED = {
  code: 'AUTH_REQUIRED',
  message: '로그인이 필요합니다.',
};

const renderAt = async (path: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { history, queryClient };
};

describe('로그인·온보딩 상태에 따른 이동', () => {
  test('로그인하지 않았으면 어느 화면에 들어오든 로그인 화면으로 보내야 한다.', async () => {
    setMockMemberStatus('signedOut');
    const { history } = await renderAt('/closet');

    expect(
      await screen.findByRole('button', { name: 'Google로 로그인' }),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/login');
  });

  test('처음부터 로그인하지 않았으면 세션 만료 안내를 띄우지 않아야 한다.', async () => {
    setMockMemberStatus('signedOut');
    await renderAt('/my-info');

    await screen.findByRole('button', { name: 'Google로 로그인' });

    expect(screen.queryByText('로그인이 만료되었어요')).not.toBeInTheDocument();
  });

  test('온보딩을 마치지 않았으면 내 정보에 들어와도 온보딩으로 보내야 한다.', async () => {
    setMockMemberStatus('needsOnboarding');
    const { history } = await renderAt('/my-info');

    expect(
      await screen.findByRole('heading', { name: '출생연도를 알려 주세요' }),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/onboarding');
  });

  test('온보딩을 마쳤으면 로그인 화면에 들어와도 옷장으로 보내야 한다.', async () => {
    const { history } = await renderAt('/login');

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
  });

  test('앱 첫 화면은 옷장이어야 한다.', async () => {
    const { history } = await renderAt('/');

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
  });

  test('401이 아닌 이유로 회원 정보를 받지 못하면 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        '/api/members/me',
        () =>
          HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    await renderAt('/closet');

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(
      await screen.findByRole('heading', { name: '옷장' }),
    ).toBeInTheDocument();
  });
});

describe('세션 만료', () => {
  test('쓰던 중 여러 요청이 동시에 401을 받아도 만료 안내는 하나만 띄워야 한다.', async () => {
    const user = userEvent.setup();
    const { queryClient, history } = await renderAt('/my-info');
    await screen.findByText('김하늘');

    server.use(
      http.get('/api/members/me', () =>
        HttpResponse.json(AUTH_REQUIRED, { status: 401 }),
      ),
      http.get('/api/members/me/settings', () =>
        HttpResponse.json(AUTH_REQUIRED, { status: 401 }),
      ),
    );
    await queryClient.invalidateQueries();

    expect(
      await screen.findByText('로그인이 만료되었어요'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(
      screen.queryByText('정보를 불러오지 못했어요'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 로그인' }));

    expect(
      await screen.findByRole('button', { name: 'Google로 로그인' }),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/login');
    expect(screen.queryByText('로그인이 만료되었어요')).not.toBeInTheDocument();
  });
});
