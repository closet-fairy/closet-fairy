import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  RecommendationHistoryItem,
  RecommendationHistoryPage,
} from '@/generated/models';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const HISTORY_URL = '/api/recommendation-history';
const NOW = new Date('2026-10-31T12:00:00+09:00');

type IntersectionCallback = (entries: { isIntersecting: boolean }[]) => void;

const intersectionCallbacks = new Set<IntersectionCallback>();

// true면 실제 브라우저처럼 관찰을 시작하자마자 끝 요소가 보인다고 알린다.
let isListEndAlwaysVisible = false;

const scrollToListEnd = () => {
  act(() => {
    for (const callback of intersectionCallbacks) {
      callback([{ isIntersecting: true }]);
    }
  });
};

const createItem = (
  overrides: Partial<RecommendationHistoryItem> = {},
): RecommendationHistoryItem => ({
  recommendation_session_id: 41,
  recommended_at: '2026-10-31T10:12:00+09:00',
  condition: {
    tpo_cd: 'date',
    tpo_text: null,
    season_cd: 'fall',
    going_out_start_at: '2026-11-01T18:00:00+09:00',
    going_out_end_at: '2026-11-01T23:30:00+09:00',
    sido_nm: '서울특별시',
    sigungu_nm: '성동구',
  },
  weather: {
    temperature: 24,
    feels_like_temperature: 22,
    weather_condition_cd: 'overcast',
    is_fallback: false,
  },
  rating: 4,
  thumbnails: [
    { slot_cd: 'top', item_name: '베이지 터틀넥', image_url: '/top.webp' },
    {
      slot_cd: 'bottom',
      item_name: '그레이 슬랙스',
      image_url: '/bottom.webp',
    },
    {
      slot_cd: 'shoes',
      item_name: '브라운 스니커즈',
      image_url: '/shoes.webp',
    },
    { slot_cd: 'socks', item_name: '흰 양말', image_url: null },
  ],
  ...overrides,
});

const usePage = (page: RecommendationHistoryPage) => {
  server.use(http.get(HISTORY_URL, () => HttpResponse.json(page)));
};

const renderHistory = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({
    initialEntries: ['/recommendation-history'],
  });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router, queryClient };
};

beforeEach(() => {
  intersectionCallbacks.clear();
  isListEndAlwaysVisible = false;
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly callback: IntersectionCallback;

      constructor(callback: IntersectionCallback) {
        this.callback = callback;
      }

      observe() {
        intersectionCallbacks.add(this.callback);

        if (isListEndAlwaysVisible) {
          queueMicrotask(() => this.callback([{ isIntersecting: true }]));
        }
      }

      disconnect() {
        intersectionCallbacks.delete(this.callback);
      }
    },
  );

  return () => {
    vi.useRealTimers();
  };
});

describe('추천 내역 목록', () => {
  test('카드에 상황, 별점, 두 시각, 썸네일, 날씨를 보여 줘야 한다.', async () => {
    usePage({ items: [createItem()], next_cursor: null });

    await renderHistory();

    const card = await screen.findByRole('article');

    expect(within(card).getByRole('heading')).toHaveTextContent('데이트');
    expect(
      within(card).getByRole('img', { name: '별점 5점 중 4점' }),
    ).toBeVisible();
    expect(within(card).getByText('오늘 10:12')).toBeInTheDocument();
    expect(
      within(card).getByText('내일 18:00 · 서울 성동구'),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('img', { name: '브라운 스니커즈' }),
    ).toBeVisible();
    expect(within(card).getByText('흰 양말')).toBeInTheDocument();
    expect(within(card).getByText('24° 흐림 · 체감 22°')).toBeInTheDocument();
    expect(within(card).queryByText('추정')).not.toBeInTheDocument();
  });

  test('직접 입력한 상황은 입력한 문구를 제목으로 보여 줘야 한다.', async () => {
    usePage({
      items: [
        createItem({
          condition: {
            ...createItem().condition,
            tpo_cd: 'custom',
            tpo_text: '친구 결혼식 2부 파티',
          },
        }),
      ],
      next_cursor: null,
    });

    await renderHistory();

    expect(
      await screen.findByRole('heading', { name: '친구 결혼식 2부 파티' }),
    ).toBeInTheDocument();
  });

  test('오래된 추천은 날짜로 보여 줘야 한다.', async () => {
    usePage({
      items: [
        createItem({
          recommended_at: '2026-08-22T07:50:00+09:00',
          condition: {
            ...createItem().condition,
            going_out_start_at: '2026-08-22T08:30:00+09:00',
            sido_nm: '세종특별자치시',
            sigungu_nm: '세종특별자치시',
          },
        }),
      ],
      next_cursor: null,
    });

    await renderHistory();

    expect(await screen.findByText('2026. 8. 22 07:50')).toBeInTheDocument();
    expect(screen.getByText('2026. 8. 22 08:30 · 세종')).toBeInTheDocument();
  });

  test('4벌이 넘으면 응답 순서대로 3칸과 남은 개수를 보여 줘야 한다.', async () => {
    const { thumbnails } = createItem();

    usePage({
      items: [
        createItem({
          thumbnails: [
            ...thumbnails,
            {
              slot_cd: 'accessories',
              item_name: '볼캡',
              image_url: '/cap.webp',
            },
          ],
        }),
      ],
      next_cursor: null,
    });

    await renderHistory();

    expect(await screen.findByText('+2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '베이지 터틀넥' })).toBeVisible();
    expect(screen.getByRole('img', { name: '브라운 스니커즈' })).toBeVisible();
    expect(screen.queryByText('흰 양말')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '볼캡' })).not.toBeInTheDocument();
  });

  test('날씨가 없으면 날씨 줄을 숨겨야 한다.', async () => {
    usePage({ items: [createItem({ weather: null })], next_cursor: null });

    await renderHistory();

    await screen.findByRole('article');
    expect(screen.queryByText(/체감/)).not.toBeInTheDocument();
  });

  test('날씨가 대체값이면 추정 표시를 붙여야 한다.', async () => {
    usePage({
      items: [
        createItem({
          weather: {
            temperature: 27,
            feels_like_temperature: 29,
            weather_condition_cd: 'clear',
            is_fallback: true,
          },
        }),
      ],
      next_cursor: null,
    });

    await renderHistory();

    expect(await screen.findByText('추정')).toBeInTheDocument();
  });

  test('목록 끝에 닿으면 다음 묶음을 이어 붙여야 한다.', async () => {
    server.use(
      http.get(HISTORY_URL, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');

        return HttpResponse.json<RecommendationHistoryPage>(
          cursor === '41'
            ? {
                items: [createItem({ recommendation_session_id: 40 })],
                next_cursor: null,
              }
            : { items: [createItem()], next_cursor: 41 },
        );
      }),
    );

    await renderHistory();
    await screen.findByRole('article');

    scrollToListEnd();

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  });

  test('마지막 묶음을 받으면 더 요청하지 않아야 한다.', async () => {
    let requestCount = 0;

    server.use(
      http.get(HISTORY_URL, ({ request }) => {
        requestCount += 1;
        const cursor = new URL(request.url).searchParams.get('cursor');

        return HttpResponse.json<RecommendationHistoryPage>(
          cursor === '41'
            ? {
                items: [createItem({ recommendation_session_id: 40 })],
                next_cursor: null,
              }
            : { items: [createItem()], next_cursor: 41 },
        );
      }),
    );

    await renderHistory();
    await screen.findByRole('article');

    scrollToListEnd();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));

    scrollToListEnd();
    await act(() => delay(50));

    expect(requestCount).toBe(2);
  });

  test('끝 요소가 계속 보여도 실패한 묶음을 저절로 다시 요청하지 않아야 한다.', async () => {
    let failedRequestCount = 0;

    isListEndAlwaysVisible = true;
    server.use(
      http.get(HISTORY_URL, async ({ request }) => {
        await delay(20);

        if (new URL(request.url).searchParams.has('cursor')) {
          failedRequestCount += 1;

          return HttpResponse.json(
            { code: 'INTERNAL', message: '서버 오류입니다.' },
            { status: 500 },
          );
        }

        return HttpResponse.json<RecommendationHistoryPage>({
          items: [createItem()],
          next_cursor: 41,
        });
      }),
    );

    await renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '더 불러오지 못했어요',
    );

    await act(() => delay(200));

    expect(failedRequestCount).toBe(1);
  });

  test('다음 묶음을 못 받아도 받아 둔 목록을 유지하고 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    let isFailing = true;

    server.use(
      http.get(HISTORY_URL, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');

        if (cursor === null) {
          return HttpResponse.json<RecommendationHistoryPage>({
            items: [createItem()],
            next_cursor: 41,
          });
        }

        return isFailing
          ? HttpResponse.json(
              { code: 'INTERNAL', message: '서버 오류입니다.' },
              { status: 500 },
            )
          : HttpResponse.json<RecommendationHistoryPage>({
              items: [createItem({ recommendation_session_id: 40 })],
              next_cursor: null,
            });
      }),
    );

    await renderHistory();
    await screen.findByRole('article');

    scrollToListEnd();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '더 불러오지 못했어요',
    );
    expect(screen.getAllByRole('article')).toHaveLength(1);

    isFailing = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('켜 둔 채 날이 바뀌면 다시 받은 뒤 시각 표기도 바뀌어야 한다.', async () => {
    usePage({ items: [createItem()], next_cursor: null });

    const { queryClient } = await renderHistory();

    expect(await screen.findByText('오늘 10:12')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-11-01T08:00:00+09:00'));
    await act(() => queryClient.refetchQueries());

    expect(await screen.findByText('어제 10:12')).toBeInTheDocument();
    expect(screen.getByText('오늘 18:00 · 서울 성동구')).toBeInTheDocument();
  });

  test('요청 오류로 다음 묶음을 못 받으면 다시 시도 버튼을 숨겨야 한다.', async () => {
    server.use(
      http.get(HISTORY_URL, ({ request }) =>
        new URL(request.url).searchParams.has('cursor')
          ? HttpResponse.json(
              { code: 'BAD_REQUEST', message: '요청이 올바르지 않습니다.' },
              { status: 422 },
            )
          : HttpResponse.json<RecommendationHistoryPage>({
              items: [createItem()],
              next_cursor: 41,
            }),
      ),
    );

    await renderHistory();
    await screen.findByRole('article');

    scrollToListEnd();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '더 불러오지 못했어요',
    );
    expect(
      screen.queryByRole('button', { name: '다시 시도' }),
    ).not.toBeInTheDocument();
  });

  test('내역이 없으면 안내하고 추천 탭으로 보내야 한다.', async () => {
    const user = userEvent.setup();

    usePage({ items: [], next_cursor: null });

    const { router } = await renderHistory();

    expect(
      await screen.findByText('아직 남긴 코디가 없어요'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '코디 추천받기' }));

    expect(router.state.location.pathname).toBe('/recommendation');
  });

  test('서버 오류로 첫 묶음을 못 받으면 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    let isFailing = true;

    server.use(
      http.get(HISTORY_URL, () =>
        isFailing
          ? HttpResponse.json(
              { code: 'INTERNAL', message: '서버 오류입니다.' },
              { status: 500 },
            )
          : HttpResponse.json<RecommendationHistoryPage>({
              items: [createItem()],
              next_cursor: null,
            }),
      ),
    );

    await renderHistory();

    expect(
      await screen.findByText('추천 내역을 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(screen.getByText('서버 오류입니다.')).toBeInTheDocument();

    isFailing = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('article')).toBeInTheDocument();
  });

  test('로그인이 만료되면 실패 화면 없이 로딩 위에 만료 안내를 보여야 한다.', async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json(
          { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
          { status: 401 },
        ),
      ),
    );

    await renderHistory();

    expect(await screen.findByText(/로그인이 만료/)).toBeInTheDocument();
    await act(() => delay(50));
    expect(
      screen.getByText('추천 내역을 불러오는 중이에요'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('추천 내역을 불러오지 못했어요'),
    ).not.toBeInTheDocument();
  });

  test('요청 오류로 첫 묶음을 못 받으면 다시 시도 버튼을 숨겨야 한다.', async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json(
          { code: 'BAD_REQUEST', message: '요청이 올바르지 않습니다.' },
          { status: 422 },
        ),
      ),
    );

    await renderHistory();

    expect(
      await screen.findByText('추천 내역을 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '다시 시도' }),
    ).not.toBeInTheDocument();
  });
});
