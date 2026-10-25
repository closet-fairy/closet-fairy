import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, test } from 'vitest';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const renderEdit = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({
    initialEntries: ['/my-info', '/my-info/edit'],
  });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await screen.findByRole('textbox', { name: '닉네임' });

  return { history };
};

const captureRequests = () => {
  const requests: { method: string; path: string; body: unknown }[] = [];
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname;

    if (request.method === 'PUT' || request.method === 'PATCH') {
      requests.push({
        method: request.method,
        path,
        body: await request.clone().json(),
      });
    }
  });

  return requests;
};

afterEach(() => {
  server.events.removeAllListeners();
});

describe('프로필 저장', () => {
  test('바꾼 닉네임과 설정을 저장하고 내 정보로 돌아가야 한다.', async () => {
    const user = userEvent.setup();
    const requests = captureRequests();
    const { history } = await renderEdit();

    const nicknameInput = screen.getByRole('textbox', { name: '닉네임' });
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '옷장요정');
    await user.click(screen.getByRole('button', { name: '보통' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(history.location.pathname).toBe('/my-info');
    });
    expect(requests).toEqual([
      {
        method: 'PUT',
        path: '/api/members/me/settings',
        body: {
          birth_year: 2001,
          temperature_sensitivity_cd: 'normal',
          gender_cd: 'female',
          style_cds: ['minimal', 'casual', 'classic'],
        },
      },
      {
        method: 'PATCH',
        path: '/api/members/me',
        body: { nickname: '옷장요정' },
      },
    ]);
  });

  test('닉네임을 바꾸지 않았으면 닉네임 수정 요청을 보내지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const requests = captureRequests();
    await renderEdit();

    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(requests.at(0)?.method).toBe('PUT');
  });

  test('닉네임을 비우면 저장하지 않고 입력란 아래에 안내해야 한다.', async () => {
    const user = userEvent.setup();
    const requests = captureRequests();
    await renderEdit();

    await user.clear(screen.getByRole('textbox', { name: '닉네임' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('닉네임은 비워 둘 수 없습니다.'),
    ).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  test('서버가 닉네임을 거절하면 입력란 아래에 서버 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/members/me', () =>
        HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message: '닉네임은 1~30자로 입력해 주세요.',
          },
          { status: 422 },
        ),
      ),
    );
    await renderEdit();

    await user.type(screen.getByRole('textbox', { name: '닉네임' }), '!');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('닉네임은 1~30자로 입력해 주세요.'),
    ).toBeInTheDocument();
  });

  test('서버가 안내 없이 닉네임을 거절해도 입력란 아래에 기본 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/members/me', () =>
        HttpResponse.json(
          { code: 'VALIDATION_ERROR', message: '' },
          { status: 422 },
        ),
      ),
    );
    await renderEdit();

    await user.type(screen.getByRole('textbox', { name: '닉네임' }), '!');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '사용할 수 없는 닉네임이에요. 다시 입력해 주세요.',
      ),
    ).toBeInTheDocument();
  });

  test('설정 저장이 실패하면 화면에 남아 실패 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/members/me/settings', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    const { history } = await renderEdit();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('저장하지 못했어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/my-info/edit');
  });

  test('설정은 저장됐는데 닉네임만 실패하면 그 사실을 구분해 알려야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/members/me', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    await renderEdit();

    await user.type(screen.getByRole('textbox', { name: '닉네임' }), '2');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '체질·성별·스타일은 저장했지만 닉네임은 저장하지 못했어요. 다시 시도해 주세요.',
      ),
    ).toBeInTheDocument();
  });

  test('로그인이 만료돼 401을 받으면 저장 실패 안내 대신 만료 안내만 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/members/me/settings', () =>
        HttpResponse.json(
          { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' },
          { status: 401 },
        ),
      ),
    );
    await renderEdit();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('로그인이 만료되었어요'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('저장하지 못했어요. 다시 시도해 주세요.'),
    ).not.toBeInTheDocument();
  });
});

describe('성별 선택', () => {
  test('프로필 수정에서는 고른 성별을 다시 눌러도 풀리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    await renderEdit();

    const femaleChip = screen.getByRole('button', { name: '여' });
    await user.click(femaleChip);

    expect(femaleChip).toHaveAttribute('aria-pressed', 'true');
  });

  test('프로필 수정에서도 고른 체질은 다시 눌러 풀 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    await renderEdit();

    const coldChip = screen.getByRole('button', { name: '추위 많이 탐' });
    await user.click(coldChip);

    expect(coldChip).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('선호 스타일 고르기', () => {
  test('스타일 화면에서 고른 뒤 완료를 누르면 프로필 수정에 반영해야 한다.', async () => {
    const user = userEvent.setup();
    await renderEdit();

    await user.click(
      screen.getByRole('button', { name: /^선호 스타일 고르기, 3개 선택/ }),
    );
    await screen.findByRole('heading', { name: '선호 스타일' });
    await user.click(screen.getByRole('button', { name: /스트릿/ }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    expect(
      await screen.findByRole('button', {
        name: '선호 스타일 고르기, 4개 선택: 미니멀, 캐주얼, 스트릿, 클래식',
      }),
    ).toBeInTheDocument();
  });

  test('완료하지 않고 뒤로 가면 고른 스타일을 버려야 한다.', async () => {
    const user = userEvent.setup();
    await renderEdit();

    await user.click(
      screen.getByRole('button', { name: /^선호 스타일 고르기, 3개 선택/ }),
    );
    await screen.findByRole('heading', { name: '선호 스타일' });
    await user.click(screen.getByRole('button', { name: /스트릿/ }));
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      await screen.findByRole('button', {
        name: /^선호 스타일 고르기, 3개 선택/,
      }),
    ).toBeInTheDocument();
  });
});
