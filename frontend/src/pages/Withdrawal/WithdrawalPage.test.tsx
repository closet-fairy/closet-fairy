import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const assign = vi.fn();

const renderWithdrawal = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({
    initialEntries: ['/my-info', '/my-info/withdraw'],
  });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await screen.findByRole('heading', { name: '회원 탈퇴', level: 2 });

  return { history };
};

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  assign.mockReset();
  vi.unstubAllGlobals();
});

describe('탈퇴 동의', () => {
  test('"탈퇴합니다"를 입력하기 전에는 탈퇴하기를 누를 수 없어야 한다.', async () => {
    const user = userEvent.setup();
    await renderWithdrawal();

    const withdrawButton = screen.getByRole('button', { name: '탈퇴하기' });
    expect(withdrawButton).toBeDisabled();

    await user.type(screen.getByRole('textbox'), '탈퇴합니');
    expect(withdrawButton).toBeDisabled();

    await user.type(screen.getByRole('textbox'), '다');
    expect(withdrawButton).toBeEnabled();
  });

  test('탈퇴하기를 누르면 서버가 준 본인 확인 주소로 이동해야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/auth/withdraw', () =>
        HttpResponse.json({
          authorize_url: 'https://accounts.example.com/authorize?state=w.1',
        }),
      ),
    );
    await renderWithdrawal();

    await user.type(screen.getByRole('textbox'), '탈퇴합니다');
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));

    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalledWith(
        'https://accounts.example.com/authorize?state=w.1',
      );
    });
  });

  test('탈퇴를 시작하지 못하면 실패 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/auth/withdraw', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    await renderWithdrawal();

    await user.type(screen.getByRole('textbox'), '탈퇴합니다');
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));

    expect(
      await screen.findByText('탈퇴를 시작하지 못했어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  test('돌아가기를 누르면 내 정보로 돌아가야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderWithdrawal();

    await user.click(screen.getByRole('button', { name: '돌아가기' }));

    await vi.waitFor(() => {
      expect(history.location.pathname).toBe('/my-info');
    });
  });
});
