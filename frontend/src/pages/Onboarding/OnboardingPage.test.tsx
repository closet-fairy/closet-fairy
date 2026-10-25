import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getKstYear } from '@/domains/member/birthYear';
import { setMockMemberStatus } from '@/mocks/handlers/member';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const renderOnboarding = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: ['/onboarding'] });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { history };
};

const continueButton = () => screen.getByRole('button', { name: '계속' });

const chooseBirthYear = async (
  user: ReturnType<typeof userEvent.setup>,
  year: number,
) => {
  await user.click(screen.getByRole('button', { name: /출생연도/ }));
  await user.click(await screen.findByRole('option', { name: `${year}년` }));
  await waitFor(() => {
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
};

const goToStyleStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });
  await chooseBirthYear(user, 2001);
  await user.click(continueButton());
  await screen.findByRole('heading', { name: '체질과 성별을 알려 주세요' });
  await user.click(continueButton());
  await screen.findByRole('heading', { name: '좋아하는 스타일을 골라 주세요' });
};

beforeEach(() => {
  setMockMemberStatus('needsOnboarding');
});

afterEach(() => {
  server.events.removeAllListeners();
});

describe('단계 이동', () => {
  test('출생연도를 고르기 전에는 다음 단계로 넘어갈 수 없어야 한다.', async () => {
    const user = userEvent.setup();
    await renderOnboarding();

    await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });
    expect(continueButton()).toBeDisabled();

    await chooseBirthYear(user, 2001);

    expect(continueButton()).toBeEnabled();
  });

  test('만 14세 미만에 해당하는 연도는 고를 수 없어야 한다.', async () => {
    const user = userEvent.setup();
    await renderOnboarding();
    await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });

    await user.click(screen.getByRole('button', { name: /출생연도/ }));

    const latestYear = getKstYear(new Date()) - 15;
    expect(
      await screen.findByRole('option', { name: `${latestYear}년` }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: `${latestYear + 1}년` }),
    ).not.toBeInTheDocument();
  });

  test('선택 단계는 아무것도 고르지 않아도 넘어갈 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    await renderOnboarding();
    await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });
    await chooseBirthYear(user, 2001);
    await user.click(continueButton());

    await screen.findByRole('heading', { name: '체질과 성별을 알려 주세요' });

    expect(screen.getByText('선택')).toBeInTheDocument();
    expect(continueButton()).toBeEnabled();
  });

  test('다음 단계로 넘어가면 새 단계의 질문 제목으로 포커스를 옮겨야 한다.', async () => {
    const user = userEvent.setup();
    await renderOnboarding();
    await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });
    await chooseBirthYear(user, 2001);

    await user.click(continueButton());

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: '체질과 성별을 알려 주세요' }),
      ).toHaveFocus();
    });
  });

  test('이전 단계로 돌아가도 입력한 값이 남아 있어야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderOnboarding();
    await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });
    await chooseBirthYear(user, 2001);
    await user.click(continueButton());
    await screen.findByRole('heading', { name: '체질과 성별을 알려 주세요' });

    await user.click(screen.getByRole('button', { name: '이전 단계' }));

    expect(
      await screen.findByRole('heading', { name: '출생연도를 알려 주세요' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /출생연도 2001년/ }),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/onboarding');
  });

  test('앞 단계 값 없이 뒤 단계 기록으로 들어오면 첫 단계로 되돌려야 한다.', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const history = createMemoryHistory({ initialEntries: ['/onboarding'] });
    history.replace('/onboarding', { onboardingStep: 3, __TSR_index: 0 });
    const router = createRouter({
      routeTree,
      history,
      context: { queryClient },
    });
    await router.load();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: '출생연도를 알려 주세요' }),
    ).toBeInTheDocument();
  });
});

describe('저장', () => {
  test('마지막 단계에서 계속을 누르면 고른 값을 한 번에 저장하고 옷장으로 가야 한다.', async () => {
    const user = userEvent.setup();
    const requestBodies: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (
        request.method === 'PUT' &&
        new URL(request.url).pathname === '/api/members/me/settings'
      ) {
        requestBodies.push(await request.clone().json());
      }
    });
    const { history } = await renderOnboarding();
    await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });
    await chooseBirthYear(user, 2001);
    await user.click(continueButton());
    await screen.findByRole('heading', { name: '체질과 성별을 알려 주세요' });
    await user.click(screen.getByRole('button', { name: '추위 많이 탐' }));
    await user.click(screen.getByRole('button', { name: '여' }));
    await user.click(screen.getByRole('button', { name: '여' }));
    await user.click(continueButton());
    await screen.findByRole('heading', {
      name: '좋아하는 스타일을 골라 주세요',
    });
    await user.click(screen.getByRole('button', { name: /클래식/ }));
    await user.click(screen.getByRole('button', { name: /미니멀/ }));

    await user.click(continueButton());

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    expect(requestBodies).toEqual([
      {
        birth_year: 2001,
        temperature_sensitivity_cd: 'cold_sensitive',
        gender_cd: null,
        style_cds: ['minimal', 'classic'],
      },
    ]);
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
    await renderOnboarding();
    await goToStyleStep(user);

    await user.click(continueButton());

    expect(
      await screen.findByText('로그인이 만료되었어요'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('저장하지 못했어요. 다시 시도해 주세요.'),
    ).not.toBeInTheDocument();
  });

  test('나이 때문에 거절되면 첫 단계로 돌아가 서버 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/members/me/settings', () =>
        HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message: '만 14세 이상만 이용할 수 있습니다.',
          },
          { status: 422 },
        ),
      ),
    );
    await renderOnboarding();
    await goToStyleStep(user);

    await user.click(continueButton());

    expect(
      await screen.findByRole('heading', { name: '출생연도를 알려 주세요' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('만 14세 이상만 이용할 수 있습니다.'),
    ).toBeInTheDocument();
  });

  test('그 밖의 이유로 저장하지 못하면 마지막 단계에 남아 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.put(
        '/api/members/me/settings',
        () =>
          HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    const { history } = await renderOnboarding();
    await goToStyleStep(user);

    await user.click(continueButton());

    expect(
      await screen.findByText('저장하지 못했어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument();

    await user.click(continueButton());

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
  });

  test('저장 실패 안내는 다른 단계에 다녀오면 사라져야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/members/me/settings', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    await renderOnboarding();
    await goToStyleStep(user);
    await user.click(continueButton());
    await screen.findByText('저장하지 못했어요. 다시 시도해 주세요.');

    await user.click(screen.getByRole('button', { name: '이전 단계' }));
    await screen.findByRole('heading', { name: '체질과 성별을 알려 주세요' });
    await user.click(continueButton());
    await screen.findByRole('heading', {
      name: '좋아하는 스타일을 골라 주세요',
    });

    expect(
      screen.queryByText('저장하지 못했어요. 다시 시도해 주세요.'),
    ).not.toBeInTheDocument();
  });
});

describe('온보딩 중 로그아웃', () => {
  test('확인 후 로그아웃하면 로그인 화면으로 가야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderOnboarding();
    await screen.findByRole('heading', { name: '출생연도를 알려 주세요' });

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    const dialog = await screen.findByRole('dialog', {
      name: '로그아웃하시겠어요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '로그아웃' }));

    expect(
      await screen.findByRole('button', { name: '구글로 시작하기' }),
    ).toBeInTheDocument();
    expect(history.location.pathname).toBe('/login');
  });
});
