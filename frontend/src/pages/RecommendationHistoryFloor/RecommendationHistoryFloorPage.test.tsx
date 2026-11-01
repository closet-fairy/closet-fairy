import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  RecommendationHistoryDetail,
  RecommendationHistoryOutfitItem,
} from '@/generated/models';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

vi.stubGlobal('matchMedia', () => ({ matches: false }));

const LIST_PATH = '/recommendation-history';
const DETAIL_PATH = `${LIST_PATH}/41`;
const FLOOR_PATH = `${DETAIL_PATH}/floor`;
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
  items: RecommendationHistoryOutfitItem[] = [createItem()],
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
  weather: null,
  rating: 4,
  outfit: { outfit_type_cd: 'preferred', reason: null, items },
});

const useDetail = (detail: RecommendationHistoryDetail) => {
  server.use(http.get(DETAIL_URL, () => HttpResponse.json(detail)));
};

const renderFloor = async (initialEntries = [FLOOR_PATH]) => {
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

const findTitle = () =>
  screen.findByRole('heading', { level: 1, name: '데이트' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });

  return () => {
    vi.useRealTimers();
  };
});

describe('코디를 바닥에 펼쳐 보기', () => {
  test('상황과 외출 구간을 제목으로, 옷 사진을 바닥에 보여 줘야 한다.', async () => {
    useDetail(createDetail());

    await renderFloor();

    expect(await findTitle()).toBeInTheDocument();
    expect(screen.getByText('오늘 18:00 – 다음 날 00:30')).toBeInTheDocument();
    expect(screen.getByAltText('베이지 터틀넥')).toHaveAttribute(
      'src',
      '/top.webp',
    );
  });

  test('하단 탭을 보여 주지 않아야 한다.', async () => {
    useDetail(createDetail());

    await renderFloor();

    await findTitle();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test('뒤로 가기로 상세에 돌아가야 한다.', async () => {
    const user = userEvent.setup();

    useDetail(createDetail());

    const { router } = await renderFloor([DETAIL_PATH, FLOOR_PATH]);

    await findTitle();
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(DETAIL_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(0);
  });

  test('주소로 바로 들어왔어도 뒤로 가기로 상세에 가야 한다.', async () => {
    const user = userEvent.setup();

    useDetail(createDetail());

    const { router } = await renderFloor();

    await findTitle();
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(DETAIL_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(0);
  });

  test('놓을 옷이 없는 코디면 안내 없이 상세로 바꿔 보내야 한다.', async () => {
    useDetail(createDetail([createItem({ image_url: null })]));

    const { router } = await renderFloor([LIST_PATH, FLOOR_PATH]);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(DETAIL_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(1);
    expect(
      await screen.findByRole('heading', { level: 2, name: '데이트' }),
    ).toBeInTheDocument();
  });

  test('없는 내역이면 상세와 같은 안내를 보여 줘야 한다.', async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: 'SESSION_NOT_FOUND', message: '찾을 수 없습니다.' },
          { status: 404 },
        ),
      ),
    );

    await renderFloor();

    expect(
      await screen.findByText('내역을 찾을 수 없어요'),
    ).toBeInTheDocument();
  });

  test('불러오지 못하면 다시 시도할 수 있어야 한다.', async () => {
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

    await renderFloor();

    expect(
      await screen.findByText('코디를 불러오지 못했어요'),
    ).toBeInTheDocument();

    isFailing = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await findTitle()).toBeInTheDocument();
  });
});

const useNotFound = () => {
  server.use(
    http.get(DETAIL_URL, () =>
      HttpResponse.json(
        { code: 'SESSION_NOT_FOUND', message: '찾을 수 없습니다.' },
        { status: 404 },
      ),
    ),
  );
};

describe('바닥 뷰의 예외 상황', () => {
  test('사진을 모두 불러오지 못해도 없는 정보 확인을 안내하지 않아야 한다.', async () => {
    useDetail(createDetail());

    await renderFloor();

    await findTitle();
    fireEvent.error(screen.getByAltText('베이지 터틀넥'));

    expect(screen.getByText('사진을 불러오지 못했어요')).toBeInTheDocument();
    expect(
      screen.queryByText('정보 확인에서 아이템을 볼 수 있어요.'),
    ).not.toBeInTheDocument();
  });

  test('없는 내역의 뒤로 가기는 이전 화면이 있어도 목록으로 바꿔 보내야 한다.', async () => {
    const user = userEvent.setup();

    useNotFound();

    const { router } = await renderFloor([DETAIL_PATH, FLOOR_PATH]);

    await screen.findByText('내역을 찾을 수 없어요');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(1);
  });

  test('없는 내역의 안내 버튼은 목록으로 바꿔 보내야 한다.', async () => {
    const user = userEvent.setup();

    useNotFound();

    const { router } = await renderFloor([DETAIL_PATH, FLOOR_PATH]);

    await user.click(
      await screen.findByRole('button', { name: '추천 내역으로 가기' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(LIST_PATH);
    });
    expect(router.history.location.state.__TSR_index).toBe(1);
  });

  test('불러오기 실패 화면의 뒤로 가기는 상세로 돌아가야 한다.', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: 'INTERNAL', message: '서버 오류입니다.' },
          { status: 500 },
        ),
      ),
    );

    const { router } = await renderFloor([DETAIL_PATH, FLOOR_PATH]);

    await screen.findByText('코디를 불러오지 못했어요');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(DETAIL_PATH);
    });
  });
});

describe('상세에서 바닥 뷰로 들어가기', () => {
  test('놓을 옷이 있으면 버튼으로 바닥 뷰에 가야 한다.', async () => {
    const user = userEvent.setup();

    useDetail(createDetail());

    const { router } = await renderFloor([DETAIL_PATH]);

    await user.click(
      await screen.findByRole('link', { name: '바닥에 펼쳐 보기' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(FLOOR_PATH);
    });
  });

  test('놓을 옷이 없으면 버튼만 숨기고 라벨은 남겨야 한다.', async () => {
    useDetail(createDetail([createItem({ image_url: null })]));

    await renderFloor([DETAIL_PATH]);

    expect(await screen.findByText('코디 아이템')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '바닥에 펼쳐 보기' }),
    ).not.toBeInTheDocument();
  });
});
