import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  RecommendationHistoryDetail,
  RecommendationHistoryOutfitItem,
  RecommendationHistoryPage,
} from '@/generated/models';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const LIST_PATH = '/recommendation-history';
const DETAIL_PATH = `${LIST_PATH}/41`;
const DETAIL_URL = '/api/recommendation-history/41';
const NOW = new Date('2026-10-31T12:00:00+09:00');

const createItem = (
  overrides: Partial<RecommendationHistoryOutfitItem> = {},
): RecommendationHistoryOutfitItem => ({
  slot_cd: 'top',
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: '베이지 터틀넥',
  image_url: '/top.webp',
  style_cds: [],
  is_clothing_deleted: false,
  ...overrides,
});

const createDetail = (
  overrides: Partial<RecommendationHistoryDetail> = {},
): RecommendationHistoryDetail => ({
  recommendation_session_id: 41,
  recommended_at: '2026-10-30T22:40:00+09:00',
  condition: {
    tpo_cd: 'date',
    tpo_text: null,
    season_cd: 'fall',
    going_out_start_at: '2026-10-31T18:00:00+09:00',
    going_out_end_at: '2026-11-01T00:30:00+09:00',
    sido_nm: '서울특별시',
    sigungu_nm: '성동구',
  },
  weather: {
    temperature: 24,
    feels_like_temperature: 22,
    weather_condition_cd: 'rain',
    is_fallback: false,
    precipitation: 1.5,
    wind_speed: 3.2,
  },
  rating: 4,
  outfit: {
    outfit_type_cd: 'preferred',
    reason: '비 소식이 있어 스니커즈를 골랐어요.',
    items: [
      createItem(),
      createItem({
        slot_cd: 'bottom',
        item_name: '그레이 슬랙스',
        is_clothing_deleted: true,
      }),
      createItem({
        slot_cd: 'socks',
        item_name: '흰 양말',
        item_source_cd: 'essential',
        image_url: null,
      }),
    ],
  },
  ...overrides,
});

const useDetail = (detail: RecommendationHistoryDetail) => {
  server.use(http.get(DETAIL_URL, () => HttpResponse.json(detail)));
};

const renderDetail = async (initialEntries = [DETAIL_PATH]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({
    initialEntries,
    initialIndex: initialEntries.length - 1,
  });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });

  return () => {
    vi.useRealTimers();
  };
});

describe('지난 추천 다시 보기', () => {
  test('상황, 두 시각, 별점, 옷, 날씨, 추천 이유를 보여 줘야 한다.', async () => {
    useDetail(createDetail());

    await renderDetail();

    expect(
      await screen.findByRole('heading', { level: 2, name: '데이트' }),
    ).toBeInTheDocument();
    expect(screen.getByText('어제 22:40')).toBeInTheDocument();
    expect(
      screen.getByText('오늘 18:00 – 다음 날 00:30 · 서울 성동구'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '별점 5점 중 4점' })).toBeVisible();
    expect(screen.getByText('24° 비')).toBeInTheDocument();
    expect(screen.getByText('체감 22° · 강수 1.5mm')).toBeInTheDocument();
    expect(
      screen.getByText('비 소식이 있어 스니커즈를 골랐어요.'),
    ).toBeInTheDocument();
  });

  test('옷은 응답 순서대로 슬롯과 함께 보여 줘야 한다.', async () => {
    useDetail(createDetail());

    await renderDetail();

    await screen.findByRole('heading', { level: 2, name: '데이트' });

    const items = within(screen.getByRole('list')).getAllByRole('listitem');

    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('상의')).toBeInTheDocument();
    expect(within(items[1]).getByText('하의')).toBeInTheDocument();
    expect(within(items[2]).getByText('양말')).toBeInTheDocument();
  });

  test('지운 옷과 기본 아이템을 구분해 보여 줘야 한다.', async () => {
    useDetail(createDetail());

    await renderDetail();

    await screen.findByRole('heading', { level: 2, name: '데이트' });

    const [owned, deleted, essential] = within(
      screen.getByRole('list'),
    ).getAllByRole('listitem');

    expect(within(owned).queryByText('지운 옷')).not.toBeInTheDocument();
    expect(within(deleted).getByText('지운 옷')).toBeInTheDocument();
    expect(within(essential).getByText('기본')).toBeInTheDocument();
  });

  test('직접 입력한 상황은 자르지 않고 제목으로 보여 줘야 한다.', async () => {
    const text = '가'.repeat(100);

    useDetail(
      createDetail({
        condition: {
          ...createDetail().condition,
          tpo_cd: 'custom',
          tpo_text: text,
        },
      }),
    );

    await renderDetail();

    expect(
      await screen.findByRole('heading', { level: 2, name: text }),
    ).toBeInTheDocument();
  });

  test('추천 이유와 날씨가 없으면 그 칸을 숨겨야 한다.', async () => {
    const detail = createDetail();

    useDetail({
      ...detail,
      weather: null,
      outfit: { ...detail.outfit, reason: null },
    });

    await renderDetail();

    await screen.findByRole('heading', { level: 2, name: '데이트' });
    expect(screen.queryByText('추천 이유')).not.toBeInTheDocument();
    expect(screen.queryByText(/체감/)).not.toBeInTheDocument();
  });

  test('강수량이 0이면 체감온도만 보여 주고, 대체값이면 추정을 붙여야 한다.', async () => {
    const detail = createDetail();
    const { weather } = detail;

    if (weather === null) {
      throw new Error('날씨가 있어야 합니다.');
    }

    useDetail({
      ...detail,
      weather: { ...weather, precipitation: 0, is_fallback: true },
    });

    await renderDetail();

    expect(await screen.findByText('체감 22°')).toBeInTheDocument();
    expect(screen.getByText('추정')).toBeInTheDocument();
  });

  test('하단 탭을 보여 주지 않아야 한다.', async () => {
    useDetail(createDetail());

    await renderDetail();

    await screen.findByRole('heading', { level: 2, name: '데이트' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test('목록에서 들어왔으면 뒤로 가기로 목록에 돌아가야 한다.', async () => {
    const user = userEvent.setup();

    useDetail(createDetail());

    const { router } = await renderDetail([LIST_PATH, DETAIL_PATH]);

    await screen.findByRole('heading', { level: 2, name: '데이트' });
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(0);
  });

  test('없는 내역이면 안내하고 목록으로 보내야 한다.', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: 'SESSION_NOT_FOUND', message: '찾을 수 없습니다.' },
          { status: 404 },
        ),
      ),
    );

    const { router } = await renderDetail();

    expect(
      await screen.findByText('내역을 찾을 수 없어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('없거나 볼 수 없는 내역이에요.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '추천 내역으로 가기' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
  });

  test('서버 오류면 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    let isFailing = true;

    server.use(
      http.get(DETAIL_URL, () =>
        isFailing
          ? HttpResponse.json(
              { code: 'INTERNAL', message: '서버 오류입니다.' },
              { status: 500 },
            )
          : HttpResponse.json(createDetail()),
      ),
    );

    await renderDetail();

    expect(
      await screen.findByText('코디를 불러오지 못했어요'),
    ).toBeInTheDocument();

    isFailing = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: '데이트' }),
    ).toBeInTheDocument();
  });

  test('요청 오류면 다시 시도 버튼을 숨겨야 한다.', async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: 'BAD_REQUEST', message: '요청이 올바르지 않습니다.' },
          { status: 422 },
        ),
      ),
    );

    await renderDetail();

    expect(
      await screen.findByText('코디를 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '다시 시도' }),
    ).not.toBeInTheDocument();
  });

  test('주소로 바로 들어와 돌아가면 상세가 스택에 남지 않아야 한다.', async () => {
    const user = userEvent.setup();

    useDetail(createDetail());

    const { router } = await renderDetail();

    await screen.findByRole('heading', { level: 2, name: '데이트' });
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(0);
  });

  test('없는 내역의 뒤로 가기는 이전 화면이 있어도 목록으로 바꿔 보내야 한다.', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: 'SESSION_NOT_FOUND', message: '찾을 수 없습니다.' },
          { status: 404 },
        ),
      ),
    );

    const { router } = await renderDetail(['/closet', DETAIL_PATH]);

    await screen.findByText('내역을 찾을 수 없어요');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(1);
  });

  test('불러오기 실패 화면에서도 뒤로 갈 수 있어야 한다.', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: 'INTERNAL', message: '서버 오류입니다.' },
          { status: 500 },
        ),
      ),
    );

    const { router } = await renderDetail([LIST_PATH, DETAIL_PATH]);

    await screen.findByText('코디를 불러오지 못했어요');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
  });

  test('불러오는 동안에도 뒤로 갈 수 있어야 한다.', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(DETAIL_URL, async () => {
        await delay('infinite');

        return HttpResponse.json(createDetail());
      }),
    );

    const { router } = await renderDetail([LIST_PATH, DETAIL_PATH]);

    await screen.findByText('코디를 불러오는 중이에요');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
  });

  test('로그인이 만료되면 실패 화면을 겹치지 않아야 한다.', async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
          { status: 401 },
        ),
      ),
    );

    await renderDetail();

    await screen.findByText('로그인이 만료되었어요');
    await expect(
      screen.findByText('코디를 불러오지 못했어요', {}, { timeout: 300 }),
    ).rejects.toThrow();
  });

  test('대체값이 아니면 추정을 붙이지 않아야 한다.', async () => {
    useDetail(createDetail());

    await renderDetail();

    await screen.findByRole('heading', { level: 2, name: '데이트' });
    expect(screen.queryByText('추정')).not.toBeInTheDocument();
  });

  test('겉옷 슬롯은 겉옷으로 보여 줘야 한다.', async () => {
    const detail = createDetail();

    useDetail({
      ...detail,
      outfit: {
        ...detail.outfit,
        items: [createItem({ slot_cd: 'outer', item_name: '오트밀 가디건' })],
      },
    });

    await renderDetail();

    expect(await screen.findByText('겉옷')).toBeInTheDocument();
  });

  test.each(['abc', '0'])(
    '번호가 %s이면 요청 없이 404 화면을 보여 줘야 한다.',
    async (param) => {
      await renderDetail([`${LIST_PATH}/${param}`]);

      expect(
        await screen.findByText('페이지를 찾을 수 없어요'),
      ).toBeInTheDocument();
    },
  );

  test('목록 카드를 누르면 상세로 가야 한다.', async () => {
    const user = userEvent.setup();

    useDetail(createDetail());
    server.use(
      http.get('/api/recommendation-history', () =>
        HttpResponse.json<RecommendationHistoryPage>({
          items: [
            {
              recommendation_session_id: 41,
              recommended_at: '2026-10-30T22:40:00+09:00',
              condition: createDetail().condition,
              weather: null,
              rating: 4,
              thumbnails: [],
            },
          ],
          next_cursor: null,
        }),
      ),
    );

    const { router } = await renderDetail([LIST_PATH]);

    await user.click(await screen.findByRole('link', { name: /데이트/ }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(DETAIL_PATH);
    });
  });
});
