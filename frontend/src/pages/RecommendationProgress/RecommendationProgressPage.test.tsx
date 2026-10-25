import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterHistory } from '@tanstack/react-router';
import {
  createBrowserHistory,
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, test } from 'vitest';
import {
  PENDING_RECOMMENDATION_STORAGE_KEY,
  RECOMMENDATION_FORM_DRAFT_STORAGE_KEY,
} from '@/constants/recommendationStorageKey';
import type { RecommendationResult } from '@/generated/models';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const SESSION_ID = 5;
const PROGRESS_PATH = `/recommendation/sessions/${SESSION_ID}`;

const form = {
  location: {
    sidoNm: '서울특별시',
    sigunguNm: '성동구',
    inputTypeCd: 'manual',
  },
  tpo: { cd: 'work' },
  customTpoText: null,
  start: { date: '2099-01-01', time: '09:00' },
  end: '14:00',
};

const savePending = (requestedAt = Date.now()) => {
  sessionStorage.setItem(
    PENDING_RECOMMENDATION_STORAGE_KEY,
    JSON.stringify({
      sessionId: SESSION_ID,
      requestedAt,
      request: {
        sido_nm: '서울특별시',
        sigungu_nm: '성동구',
        location_input_type_cd: 'manual',
        tpo_cd: 'work',
        going_out_start_time: '09:00',
        going_out_end_time: '14:00',
        going_out_date_cd: 'today',
      },
      form,
    }),
  );
};

const createResult = (
  generationStatusCd: RecommendationResult['generation_status_cd'],
  sessionStatusCd: RecommendationResult['session_status_cd'] = 'active',
): RecommendationResult => ({
  recommendation_session_id: SESSION_ID,
  generation_status_cd: generationStatusCd,
  session_status_cd: sessionStatusCd,
  is_clothing_shortage: false,
  condition: {
    tpo_cd: 'work',
    tpo_text: null,
    season_cd: 'fall',
    going_out_start_at: '2026-10-26T09:00:00+09:00',
    going_out_end_at: '2026-10-26T14:00:00+09:00',
  },
  weather: null,
  outfits: [],
});

const respondResult = (result: RecommendationResult) => {
  server.use(
    http.get(`/api/recommendation-sessions/${SESSION_ID}`, () =>
      HttpResponse.json(result),
    ),
  );
};

const countCancelRequests = () => {
  const counter = { count: 0 };
  server.use(
    http.post(`/api/recommendation-sessions/${SESSION_ID}/cancel`, () => {
      counter.count += 1;

      return HttpResponse.json({
        recommendation_session_id: SESSION_ID,
        session_status_cd: 'canceled',
      });
    }),
  );

  return counter;
};

const renderAt = async (entries: string[]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({
    initialEntries: entries,
    initialIndex: entries.length - 1,
  });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();
  // 입력 화면은 코드 분할로 늦게 불러오므로, 돌아가는 화면을 기다리는 단언이 불러오는 시간에 걸리지 않게 미리 받아 둔다.
  await router.preloadRoute({ to: '/recommendation' });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { history };
};

const browserHistories: RouterHistory[] = [];

const renderWithBrowserHistory = async () => {
  window.history.replaceState(null, '', '/my-info');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createBrowserHistory();
  browserHistories.push(history);
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();
  await router.preloadRoute({ to: '/recommendation' });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await router.navigate({ to: '/recommendation' });
  await router.navigate({
    to: '/recommendation/sessions/$sessionId',
    params: { sessionId: SESSION_ID },
  });
  await screen.findByText('코디를 만들고 있어요');

  return { router };
};

afterEach(() => {
  sessionStorage.clear();
  browserHistories.splice(0).forEach((history) => {
    history.destroy();
  });
  window.history.replaceState(null, '', '/');
});

describe('진행 화면에서 이동', () => {
  test('방금 요청한 추천이 바로 끝나도 진행 화면을 1초 보여 준 뒤 결과로 이동해야 한다.', async () => {
    const requestedAt = Date.now();
    savePending(requestedAt);
    respondResult(createResult('completed'));
    const { history } = await renderAt(['/recommendation', PROGRESS_PATH]);
    let navigatedAt: number | null = null;
    const unsubscribe = history.subscribe(() => {
      if (
        navigatedAt === null &&
        history.location.pathname.endsWith('/result')
      ) {
        navigatedAt = Date.now();
      }
    });

    expect(await screen.findByText('코디를 만들고 있어요')).toBeInTheDocument();
    await waitFor(
      () => {
        expect(history.location.pathname).toBe(`${PROGRESS_PATH}/result`);
      },
      { timeout: 3000 },
    );
    unsubscribe();

    // 타이머는 조금 일찍 깨어날 수 있어 몇 ms의 오차를 둔다.
    expect((navigatedAt ?? 0) - requestedAt).toBeGreaterThanOrEqual(950);
    expect(
      sessionStorage.getItem(PENDING_RECOMMENDATION_STORAGE_KEY),
    ).toBeNull();
  });

  test('이미 끝난 세션으로 다시 들어오면 기다리지 않고 결과로 이동해야 한다.', async () => {
    respondResult(createResult('completed'));
    const { history } = await renderAt([PROGRESS_PATH]);
    const startedAt = Date.now();

    await waitFor(() => {
      expect(history.location.pathname).toBe(`${PROGRESS_PATH}/result`);
    });
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  test('취소나 이탈로 끝난 세션이면 입력 화면으로 돌아가야 한다.', async () => {
    respondResult(createResult('failed', 'canceled'));
    const cancelRequests = countCancelRequests();
    const { history } = await renderAt([PROGRESS_PATH]);

    await waitFor(() => {
      expect(history.location.pathname).toBe('/recommendation');
    });
    expect(cancelRequests.count).toBe(0);
  });

  test('추천을 만들지 못하면 세션을 취소하고 입력값을 남긴 채 입력 화면으로 돌아가야 한다.', async () => {
    savePending(0);
    respondResult(createResult('failed'));
    const cancelRequests = countCancelRequests();
    const { history } = await renderAt(['/recommendation', PROGRESS_PATH]);

    await waitFor(() => {
      expect(history.location.pathname).toBe('/recommendation');
    });
    expect(cancelRequests.count).toBe(1);
    expect(
      await screen.findByRole('button', { name: /^위치 서울 성동구/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '출근' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      sessionStorage.getItem(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY),
    ).toBeNull();
  });

  test('상태를 불러오지 못하면 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    respondResult(createResult('processing'));
    server.use(
      http.get(
        `/api/recommendation-sessions/${SESSION_ID}`,
        () =>
          HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    await renderAt([PROGRESS_PATH]);

    expect(
      await screen.findByText('추천 상태를 확인하지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('처리 중 오류가 발생했습니다.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('코디를 만들고 있어요')).toBeInTheDocument();
  });
});

describe('진행 중 그만두기', () => {
  test('그만두기 버튼은 1초 뒤에 나타나고, 확인하면 세션을 취소한 뒤 입력값을 남긴 채 입력 화면으로 돌아가야 한다.', async () => {
    const user = userEvent.setup();
    savePending();
    respondResult(createResult('processing'));
    const cancelRequests = countCancelRequests();
    const { history } = await renderAt(['/recommendation', PROGRESS_PATH]);

    expect(await screen.findByText('코디를 만들고 있어요')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '추천 그만두기' }),
    ).not.toBeInTheDocument();

    await user.click(
      await screen.findByRole(
        'button',
        { name: '추천 그만두기' },
        { timeout: 2000 },
      ),
    );
    const dialog = await screen.findByRole('dialog', {
      name: '추천을 그만둘까요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '그만두기' }));

    await waitFor(() => {
      expect(history.location.pathname).toBe('/recommendation');
    });
    expect(cancelRequests.count).toBe(1);
    expect(
      await screen.findByRole('button', { name: /^위치 서울 성동구/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '출근' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      sessionStorage.getItem(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY),
    ).toBeNull();
  });

  test('계속 기다리기를 고르면 취소하지 않고 진행 화면에 남아야 한다.', async () => {
    const user = userEvent.setup();
    respondResult(createResult('processing'));
    const cancelRequests = countCancelRequests();
    const { history } = await renderAt(['/recommendation', PROGRESS_PATH]);

    await user.click(
      await screen.findByRole(
        'button',
        { name: '추천 그만두기' },
        { timeout: 2000 },
      ),
    );
    const dialog = await screen.findByRole('dialog', {
      name: '추천을 그만둘까요?',
    });
    await user.click(
      within(dialog).getByRole('button', { name: '계속 기다리기' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(history.location.pathname).toBe(PROGRESS_PATH);
    expect(cancelRequests.count).toBe(0);
  });
});

describe('뒤로 가기', () => {
  const findDialog = () =>
    screen.findByRole('dialog', { name: '추천을 그만둘까요?' });

  test('뒤로 가기를 누르고 그만두면 세션을 취소하고 입력값을 남긴 채 입력 화면으로 돌아가야 한다.', async () => {
    const user = userEvent.setup();
    savePending(0);
    respondResult(createResult('processing'));
    const cancelRequests = countCancelRequests();
    const { router } = await renderWithBrowserHistory();

    window.history.back();
    await user.click(
      within(await findDialog()).getByRole('button', { name: '그만두기' }),
    );

    expect(
      await screen.findByRole('button', { name: /^위치 서울 성동구/ }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/recommendation');
    expect(window.location.pathname).toBe('/recommendation');
    expect(cancelRequests.count).toBe(1);
  });

  test('계속 기다리면 주소를 진행 화면으로 되돌리고, 다시 뒤로 가면 또 물어야 한다.', async () => {
    const user = userEvent.setup();
    respondResult(createResult('processing'));
    const cancelRequests = countCancelRequests();
    await renderWithBrowserHistory();

    window.history.back();
    await user.click(
      within(await findDialog()).getByRole('button', { name: '계속 기다리기' }),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe(PROGRESS_PATH);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    window.history.back();

    expect(await findDialog()).toBeInTheDocument();
    expect(cancelRequests.count).toBe(0);
  });

  test('확인 창이 떠 있는 동안 추천이 끝나면 창을 닫고 진행 화면 기록을 결과로 바꿔야 한다.', async () => {
    respondResult(createResult('processing'));
    const { router } = await renderWithBrowserHistory();

    window.history.back();
    await findDialog();
    respondResult(createResult('completed'));

    await waitFor(
      () => {
        expect(window.location.pathname).toBe(`${PROGRESS_PATH}/result`);
      },
      { timeout: 4000 },
    );
    expect(router.state.location.pathname).toBe(`${PROGRESS_PATH}/result`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    window.history.back();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/recommendation');
    });
  });

  test('취소를 요청하는 중에 뒤로 가기를 눌러도 입력 화면에서 멈춰야 한다.', async () => {
    const user = userEvent.setup();
    savePending(0);
    respondResult(createResult('processing'));
    let cancelRequestCount = 0;
    server.use(
      http.post(
        `/api/recommendation-sessions/${SESSION_ID}/cancel`,
        async () => {
          cancelRequestCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 300));

          return HttpResponse.json({
            recommendation_session_id: SESSION_ID,
            session_status_cd: 'canceled',
          });
        },
      ),
    );
    await renderWithBrowserHistory();

    await user.click(
      await screen.findByRole(
        'button',
        { name: '추천 그만두기' },
        { timeout: 2000 },
      ),
    );
    await user.click(
      within(await findDialog()).getByRole('button', { name: '그만두기' }),
    );
    window.history.back();

    expect(
      await screen.findByRole('button', { name: /^위치 서울 성동구/ }),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(window.location.pathname).toBe('/recommendation');
    expect(cancelRequestCount).toBe(1);
  });

  test('추천 그만두기 버튼으로 그만두면 진행 화면 기록을 지나 입력 화면으로 돌아가야 한다.', async () => {
    const user = userEvent.setup();
    savePending(0);
    respondResult(createResult('processing'));
    const cancelRequests = countCancelRequests();
    await renderWithBrowserHistory();

    await user.click(
      await screen.findByRole(
        'button',
        { name: '추천 그만두기' },
        { timeout: 2000 },
      ),
    );
    await user.click(
      within(await findDialog()).getByRole('button', { name: '그만두기' }),
    );

    expect(
      await screen.findByRole('button', { name: /^위치 서울 성동구/ }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/recommendation');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancelRequests.count).toBe(1);

    window.history.back();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-info');
    });
  });

  test('확인 창이 떠 있는 동안 앞으로 가기로 돌아오면 창을 닫고 계속 기다려야 한다.', async () => {
    respondResult(createResult('processing'));
    await renderWithBrowserHistory();

    window.history.back();
    await findDialog();
    window.history.forward();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(window.location.pathname).toBe(PROGRESS_PATH);
    expect(screen.getByText('코디를 만들고 있어요')).toBeInTheDocument();
  });
});
