import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { setMockMemberStatus } from '@/mocks/handlers/member';
import { routeTree } from '@/routeTree.gen';

// 라우트 코드를 처음 불러오는 데 테스트 기본 대기 시간보다 오래 걸릴 수 있다.
const ROUTE_LOAD_TIMEOUT = 5000;

const watchNotFoundPage = () => {
  let hasAppeared = false;
  const observer = new MutationObserver(() => {
    hasAppeared ||= screen.queryByText('페이지를 찾을 수 없어요') !== null;
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    stop: () => {
      observer.disconnect();

      return hasAppeared;
    },
  };
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

  return { history };
};

describe('찾을 수 없는 주소', () => {
  test.each([
    '/abc',
    '/closet/1/없는화면',
    '/my-info/없는화면',
    '/closet/abc',
    '/closet/abc/edit',
    '/recommendation/sessions/abc',
  ])('%s에서는 404 화면과 하단 탭을 보여 줘야 한다.', async (path) => {
    await renderAt(path);

    expect(
      await screen.findByRole('heading', { name: '페이지를 찾을 수 없어요' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('주소가 잘못되었거나 없어진 페이지예요.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: '주요 메뉴' }),
    ).toBeInTheDocument();
  });

  test('어떤 탭에도 속하지 않는 주소에서는 활성 탭이 없어야 한다.', async () => {
    await renderAt('/abc');

    await screen.findByRole('heading', { name: '페이지를 찾을 수 없어요' });

    expect(
      screen.queryByRole('link', { current: 'page' }),
    ).not.toBeInTheDocument();
  });

  test('옷장 아래의 없는 주소에서는 옷장 탭이 활성이어야 한다.', async () => {
    await renderAt('/closet/1/없는화면');

    await screen.findByRole('heading', { name: '페이지를 찾을 수 없어요' });

    expect(screen.getByRole('link', { current: 'page' })).toHaveAccessibleName(
      '옷장',
    );
  });

  test('로그인하지 않았으면 404 화면을 거치지 않고 로그인 화면으로 보내야 한다.', async () => {
    setMockMemberStatus('signedOut');
    const notFoundWatcher = watchNotFoundPage();
    const { history } = await renderAt('/abc');

    expect(
      await screen.findByRole(
        'button',
        { name: '구글로 시작하기' },
        { timeout: ROUTE_LOAD_TIMEOUT },
      ),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/login');
    expect(notFoundWatcher.stop()).toBe(false);
  });

  test('온보딩을 마치지 않았으면 404 화면을 거치지 않고 온보딩으로 보내야 한다.', async () => {
    setMockMemberStatus('needsOnboarding');
    const notFoundWatcher = watchNotFoundPage();
    const { history } = await renderAt('/abc');

    expect(
      await screen.findByRole(
        'heading',
        { name: '출생연도를 알려 주세요' },
        { timeout: ROUTE_LOAD_TIMEOUT },
      ),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/onboarding');
    expect(notFoundWatcher.stop()).toBe(false);
  });
});

describe('옷장으로 가기', () => {
  test('누르면 뒤로 가기로 404에 돌아오지 않도록 현재 기록을 바꿔 옷장으로 가야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderAt('/abc');

    await user.click(
      await screen.findByRole('button', { name: '옷장으로 가기' }),
    );

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    expect(history.length).toBe(1);
  });
});
