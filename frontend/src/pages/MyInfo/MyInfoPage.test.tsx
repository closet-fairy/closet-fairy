import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { getKstYear, toAgeGroup } from '@/domains/member/birthYear';
import { getGetMySettingsMembersMeSettingsGetQueryKey } from '@/generated/endpoints/member/member';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

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

describe('내 정보 조회', () => {
  test('닉네임, 가입 정보, 추천에 쓰이는 정보를 보여 줘야 한다.', async () => {
    await renderAt('/my-info');

    expect(await screen.findByText('김하늘')).toBeInTheDocument();
    expect(
      screen.getByText('구글 계정 · 2026년 8월 12일 가입'),
    ).toBeInTheDocument();
    expect(await screen.findByText('추위 많이 탐')).toBeInTheDocument();
    expect(
      screen.getByText(toAgeGroup(2001, getKstYear(new Date()))),
    ).toBeInTheDocument();
    expect(screen.getByText('여')).toBeInTheDocument();
    expect(screen.getByText('미니멀')).toBeInTheDocument();
  });

  test('설정을 불러오지 못하면 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        '/api/members/me/settings',
        () =>
          HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    await renderAt('/my-info');

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('추위 많이 탐')).toBeInTheDocument();
  });

  test('이미 불러온 설정이 있으면 다시 불러오기가 실패해도 실패 안내를 띄우지 않아야 한다.', async () => {
    const { queryClient } = await renderAt('/my-info');
    await screen.findByText('추위 많이 탐');

    server.use(
      http.get('/api/members/me/settings', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    const settingsQueryKey = getGetMySettingsMembersMeSettingsGetQueryKey();
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: settingsQueryKey });
    });

    expect(queryClient.getQueryState(settingsQueryKey)?.status).toBe('error');
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.getByText('추위 많이 탐')).toBeInTheDocument();
    expect(
      screen.queryByText('정보를 불러오지 못했어요.'),
    ).not.toBeInTheDocument();
  });
});

describe('탈퇴 실패 안내', () => {
  test('다른 계정으로 본인 확인을 해서 돌아오면 탈퇴하지 않았다고 알리고 주소의 사유를 지워야 한다.', async () => {
    const { history } = await renderAt(
      '/my-info?withdraw_error=account_mismatch',
    );

    expect(
      await screen.findByText(
        '가입한 계정과 다른 계정으로 확인해 탈퇴하지 않았어요.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(history.location.search).toBe('');
    });
  });
});

describe('로그아웃', () => {
  test('확인 모달에서 로그아웃하면 로그인 화면으로 가야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderAt('/my-info');

    await user.click(await screen.findByRole('button', { name: '로그아웃' }));
    const dialog = await screen.findByRole('dialog', {
      name: '로그아웃하시겠어요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '로그아웃' }));

    expect(
      await screen.findByRole('button', { name: '구글로 시작하기' }),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/login');
  });

  test('취소하면 내 정보에 그대로 남아야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderAt('/my-info');

    await user.click(await screen.findByRole('button', { name: '로그아웃' }));
    const dialog = await screen.findByRole('dialog', {
      name: '로그아웃하시겠어요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '취소' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(history.location.pathname).toBe('/my-info');
  });

  test('로그아웃 요청이 실패하면 모달 안에 실패 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/auth/logout', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    await renderAt('/my-info');

    await user.click(await screen.findByRole('button', { name: '로그아웃' }));
    const dialog = await screen.findByRole('dialog', {
      name: '로그아웃하시겠어요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '로그아웃' }));

    expect(
      await within(dialog).findByText(
        '로그아웃하지 못했어요. 다시 시도해 주세요.',
      ),
    ).toBeInTheDocument();
  });
});
