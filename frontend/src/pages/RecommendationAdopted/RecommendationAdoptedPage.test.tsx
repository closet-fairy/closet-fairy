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
import type { RecommendationHistoryDetail } from '@/generated/models';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

const SESSION_ID = 5;
const ADOPTED_PATH = `/recommendation/sessions/${SESSION_ID}/adopted`;
const HISTORY_URL = `/api/recommendation-history/${SESSION_ID}`;

type Item = RecommendationHistoryDetail['outfit']['items'][number];

const createItem = (
  slotCd: Item['slot_cd'],
  itemName: string,
  overrides: Partial<Item> = {},
): Item => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: itemName,
  image_url: '/media/clothing/1/sample_cutout.webp',
  style_cds: [],
  is_clothing_deleted: false,
  ...overrides,
});

const createDetail = (
  items: Item[],
  overrides: Partial<RecommendationHistoryDetail> = {},
): RecommendationHistoryDetail => ({
  recommendation_session_id: SESSION_ID,
  recommended_at: '2026-08-23T08:30:00+09:00',
  condition: {
    tpo_cd: 'daily',
    tpo_text: null,
    season_cd: 'summer',
    going_out_start_at: '2026-08-23T09:00:00+09:00',
    going_out_end_at: '2026-08-23T14:00:00+09:00',
    sido_nm: '서울특별시',
    sigungu_nm: '성동구',
  },
  weather: {
    temperature: 24,
    feels_like_temperature: 23,
    weather_condition_cd: 'overcast',
    is_fallback: false,
    precipitation: 0,
    wind_speed: 1,
  },
  rating: 4,
  outfit: { outfit_type_cd: 'preferred', reason: null, items },
  ...overrides,
});

const useDetail = (detail: RecommendationHistoryDetail) => {
  server.use(http.get(HISTORY_URL, () => HttpResponse.json(detail)));
};

const renderAdopted = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [ADOPTED_PATH] }),
    context: { queryClient },
  });

  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router };
};

describe('채택 완료 화면', () => {
  test('날짜, 상황, 날씨, 별점을 보여 줘야 한다.', async () => {
    useDetail(createDetail([createItem('top', '베이지 터틀넥')]));
    await renderAdopted();

    expect(
      await screen.findByText('8월 23일 · 데일리 · 24° 흐림'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /5점 중 4점/ })).toBeInTheDocument();
    expect(screen.getByAltText('베이지 터틀넥')).toBeInTheDocument();
  });

  test('날씨가 없으면 날짜와 상황만 보여 줘야 한다.', async () => {
    useDetail(createDetail([], { weather: null }));
    await renderAdopted();

    expect(await screen.findByText('8월 23일 · 데일리')).toBeInTheDocument();
  });

  test('아이템이 5개 이상이면 3칸과 남은 개수를 보여 줘야 한다.', async () => {
    useDetail(
      createDetail([
        createItem('top', '상의'),
        createItem('bottom', '하의'),
        createItem('shoes', '신발'),
        createItem('outer', '아우터'),
        createItem('socks', '양말'),
      ]),
    );
    await renderAdopted();

    expect(await screen.findByText('+2')).toBeInTheDocument();
    expect(screen.getByAltText('하의')).toBeInTheDocument();
    expect(screen.queryByAltText('양말')).not.toBeInTheDocument();
  });

  test('이미지가 없는 아이템은 이름으로 보여 줘야 한다.', async () => {
    useDetail(
      createDetail([
        createItem('socks', '흰 양말', {
          item_source_cd: 'essential',
          image_url: null,
        }),
      ]),
    );
    await renderAdopted();

    expect(await screen.findByText('흰 양말')).toBeInTheDocument();
  });

  test('닫기를 누르면 추천 입력 화면으로 보내야 한다.', async () => {
    const user = userEvent.setup();
    useDetail(createDetail([]));
    const { router } = await renderAdopted();

    await user.click(await screen.findByRole('button', { name: '닫기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recommendation');
    });
  });

  test('추천 내역에서 보기를 누르면 내역 탭으로 보내야 한다.', async () => {
    const user = userEvent.setup();
    useDetail(createDetail([]));
    const { router } = await renderAdopted();

    await user.click(
      await screen.findByRole('button', { name: '추천 내역에서 보기' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recommendation-history');
    });
  });

  test('없는 내역이면 볼 수 없는 추천 화면을 보여 줘야 한다.', async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json(
          { code: 'SESSION_NOT_FOUND', message: '찾을 수 없습니다.' },
          { status: 404 },
        ),
      ),
    );
    await renderAdopted();

    expect(
      await screen.findByText('볼 수 없는 추천이에요'),
    ).toBeInTheDocument();
  });

  test('불러오지 못하면 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json(
          { code: 'SERVER_ERROR', message: '서버에 문제가 생겼어요.' },
          { status: 500 },
        ),
      ),
    );
    await renderAdopted();

    await screen.findByText('코디를 불러오지 못했어요');

    useDetail(createDetail([]));
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(
      await screen.findByText('오늘의 코디로 채택했어요'),
    ).toBeInTheDocument();
  });
});
