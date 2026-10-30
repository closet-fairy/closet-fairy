import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterHistory } from '@tanstack/react-router';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import type {
  OutfitItemResult,
  OutfitResult,
  RecommendationResult,
} from '@/generated/models';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

// jsdom에는 matchMedia가 없어서, 캐러셀이 그려지도록 빈 구현을 둔다.
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}));

const SESSION_ID = 5;
const INPUT_PATH = '/recommendation';
const RESULT_PATH = `/recommendation/sessions/${SESSION_ID}/result`;
const PROGRESS_PATH = `/recommendation/sessions/${SESSION_ID}`;
const SESSION_URL = `/api/recommendation-sessions/${SESSION_ID}`;
const IMAGE_URL = '/media/clothing/1/sample_cutout.webp';

const createItem = (
  slotCd: OutfitItemResult['slot_cd'],
  itemName: string,
  overrides: Partial<OutfitItemResult> = {},
): OutfitItemResult => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: itemName,
  image_url: IMAGE_URL,
  style_cds: ['minimal'],
  ...overrides,
});

const createOutfit = (
  seq: number,
  overrides: Partial<OutfitResult> = {},
): OutfitResult => ({
  outfit_id: 50 + seq,
  outfit_seq: seq,
  outfit_type_cd: 'preferred',
  reason: `${seq}번 코디를 고른 이유예요.`,
  items: [
    createItem('top', `${seq}번 상의`),
    createItem('bottom', `${seq}번 하의`),
    createItem('shoes', `${seq}번 신발`),
  ],
  previous_outfits: [],
  ...overrides,
});

const createResult = (
  overrides: Partial<RecommendationResult> = {},
): RecommendationResult => ({
  recommendation_session_id: SESSION_ID,
  generation_status_cd: 'completed',
  session_status_cd: 'active',
  is_clothing_shortage: false,
  condition: {
    tpo_cd: 'daily',
    tpo_text: null,
    season_cd: 'fall',
    going_out_start_at: '2026-10-26T09:00:00+09:00',
    going_out_end_at: '2026-10-26T14:00:00+09:00',
  },
  weather: {
    temperature: 24,
    feels_like_temperature: 23,
    weather_condition_cd: 'overcast',
    is_fallback: false,
  },
  outfits: [createOutfit(1), createOutfit(2)],
  latest_regeneration: null,
  ...overrides,
});

const useResult = (result: RecommendationResult) => {
  server.use(http.get(SESSION_URL, () => HttpResponse.json(result)));
};

const useErrorResult = (status: number, message = '문제가 생겼어요.') => {
  server.use(
    http.get(SESSION_URL, () =>
      HttpResponse.json({ code: 'SOME_ERROR', message }, { status }),
    ),
  );
};

const useCancelSpy = () => {
  const requests: string[] = [];

  server.use(
    http.post(`${SESSION_URL}/cancel`, ({ request }) => {
      requests.push(request.url);

      return HttpResponse.json({
        recommendation_session_id: SESSION_ID,
        session_status_cd: 'canceled',
      });
    }),
  );

  return requests;
};

const renderResult = async (
  history: RouterHistory = createMemoryHistory({
    initialEntries: [RESULT_PATH],
  }),
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

  return { router, history, queryClient };
};

const openInfoSheet = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: '정보 확인' }));

  return screen.findByRole('dialog', { name: '코디 정보' });
};

describe('결과 기본 화면', () => {
  test('코디의 옷과 번호, 스타일 태그를 보여 줘야 한다.', async () => {
    useResult(createResult());
    await renderResult();

    expect(await screen.findByAltText('1번 상의')).toBeInTheDocument();
    expect(screen.getByText('/ 2')).toBeInTheDocument();
    expect(screen.getAllByText('미니멀')[0]).toBeInTheDocument();
  });

  test('코디가 1벌이면 번호와 좌우 화살표를 숨겨야 한다.', async () => {
    useResult(createResult({ outfits: [createOutfit(1)] }));
    await renderResult();

    await screen.findByAltText('1번 상의');

    expect(screen.queryByText('/ 1')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '다음 슬라이드' }),
    ).not.toBeInTheDocument();
  });

  test('에센셜과 이미지가 없는 아이템은 바닥에서 빼야 한다.', async () => {
    useResult(
      createResult({
        outfits: [
          createOutfit(1, {
            items: [
              createItem('top', '내 상의'),
              createItem('bottom', '기본 하의', {
                item_source_cd: 'essential',
                image_url: null,
              }),
              createItem('shoes', '사진 없는 신발', { image_url: null }),
            ],
          }),
        ],
      }),
    );
    await renderResult();

    expect(await screen.findByAltText('내 상의')).toBeInTheDocument();
    expect(screen.queryByAltText('기본 하의')).not.toBeInTheDocument();
    expect(screen.queryByAltText('사진 없는 신발')).not.toBeInTheDocument();
    expect(
      screen.queryByText('이 코디는 미리보기를 지원하지 않아요'),
    ).not.toBeInTheDocument();
  });

  test('바닥에 놓을 옷이 없으면 미리보기 안내를 보여 줘야 한다.', async () => {
    useResult(
      createResult({
        outfits: [
          createOutfit(1, {
            items: [
              createItem('top', '기본 상의', {
                item_source_cd: 'essential',
                image_url: null,
              }),
            ],
          }),
        ],
      }),
    );
    await renderResult();

    expect(
      await screen.findByText('이 코디는 미리보기를 지원하지 않아요'),
    ).toBeInTheDocument();
  });

  test('불러오는 동안에는 불러오는 중 문구를 보여 줘야 한다.', async () => {
    server.use(
      http.get(SESSION_URL, async () => {
        await new Promise(() => undefined);
      }),
    );
    await renderResult();

    expect(
      await screen.findByText('코디를 불러오는 중이에요'),
    ).toBeInTheDocument();
  });
});

describe('정보 서랍', () => {
  test('아이템 격자와 날씨, 추천 이유를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResult();

    const sheet = await openInfoSheet(user);

    expect(within(sheet).getByText('1번 상의')).toBeInTheDocument();
    expect(within(sheet).getByText('24° 흐림')).toBeInTheDocument();
    expect(within(sheet).getByText('1번 코디를 고른 이유예요.')).toBeVisible();
  });

  test('추천 이유가 없으면 그 칸을 숨겨야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult({ outfits: [createOutfit(1, { reason: null })] }));
    await renderResult();

    const sheet = await openInfoSheet(user);

    expect(within(sheet).queryByText('추천 이유')).not.toBeInTheDocument();
  });

  test('에센셜에는 기본 표시를 붙여야 한다.', async () => {
    const user = userEvent.setup();
    useResult(
      createResult({
        outfits: [
          createOutfit(1, {
            items: [
              createItem('socks', '흰 양말', {
                item_source_cd: 'essential',
                image_url: null,
              }),
            ],
          }),
        ],
      }),
    );
    await renderResult();

    const sheet = await openInfoSheet(user);

    expect(within(sheet).getByText('기본')).toBeInTheDocument();
  });

  test('대체값으로 추천했으면 날씨에 추정 표시를 붙여야 한다.', async () => {
    const user = userEvent.setup();
    useResult(
      createResult({
        weather: {
          temperature: 24,
          feels_like_temperature: 23,
          weather_condition_cd: 'overcast',
          is_fallback: true,
        },
      }),
    );
    await renderResult();

    const sheet = await openInfoSheet(user);

    expect(within(sheet).getByText('추정')).toBeInTheDocument();
    expect(
      within(sheet).getByText('날씨를 불러오지 못해 예상 날씨로 골랐어요.'),
    ).toBeInTheDocument();
  });
});

describe('조회 상태', () => {
  test('생성 중인 세션이면 안내 없이 진행 화면으로 이동해야 한다.', async () => {
    useResult(
      createResult({ generation_status_cd: 'processing', outfits: [] }),
    );
    const { router } = await renderResult();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(PROGRESS_PATH);
    });
  });

  test.each([
    ['failed', 'active'],
    ['failed', 'canceled'],
    ['completed', 'abandoned'],
  ] as const)(
    '생성 %s, 세션 %s인 주소를 처음 열면 볼 수 없는 추천 화면을 보여 줘야 한다.',
    async (generationStatusCd, sessionStatusCd) => {
      useResult(
        createResult({
          generation_status_cd: generationStatusCd,
          session_status_cd: sessionStatusCd,
          outfits: [],
        }),
      );
      await renderResult();

      expect(
        await screen.findByText('볼 수 없는 추천이에요'),
      ).toBeInTheDocument();
    },
  );

  test('이미 채택한 세션을 열면 볼 수 없는 추천 화면을 보여 줘야 한다.', async () => {
    useResult(
      createResult({
        session_status_cd: 'completed',
        outfits: [createOutfit(1)],
      }),
    );
    await renderResult();

    expect(
      await screen.findByText('볼 수 없는 추천이에요'),
    ).toBeInTheDocument();
  });

  test('404 응답이면 볼 수 없는 추천 화면을 보여 주고 옷장으로 보내야 한다.', async () => {
    const user = userEvent.setup();
    useErrorResult(404);
    const { router } = await renderResult();

    await user.click(
      await screen.findByRole('button', { name: '옷장으로 가기' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/closet');
    });
  });

  test('불러오지 못하면 사라진다는 안내와 다시 시도를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    useErrorResult(500, '서버에 문제가 생겼어요.');
    await renderResult();

    expect(
      await screen.findByText('코디를 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/돌아가면 이번 추천은 사라져요/),
    ).toBeInTheDocument();

    useResult(createResult());
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByAltText('1번 상의')).toBeInTheDocument();
  });

  test('불러오기 실패에서 돌아가면 세션을 취소하고 입력 화면으로 보내야 한다.', async () => {
    const user = userEvent.setup();
    const cancelRequests = useCancelSpy();
    useErrorResult(500);
    const { router } = await renderResult();

    await user.click(await screen.findByRole('button', { name: '돌아가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(INPUT_PATH);
    });
    expect(cancelRequests).toHaveLength(1);
  });
});
