import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterHistory } from '@tanstack/react-router';
import {
  createBrowserHistory,
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { REGENERATION_FAILURE_NOTICE_STORAGE_KEY } from '@/constants/recommendationStorageKey';
import type {
  OutfitItemResult,
  OutfitResult,
  RecommendationHistoryDetail,
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
const ADOPTED_PATH = `/recommendation/sessions/${SESSION_ID}/adopted`;
const PROGRESS_PATH = `/recommendation/sessions/${SESSION_ID}`;
const SESSION_URL = `/api/recommendation-sessions/${SESSION_ID}`;
const HISTORY_URL = `/api/recommendation-history/${SESSION_ID}`;
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

const historyDetail: RecommendationHistoryDetail = {
  recommendation_session_id: SESSION_ID,
  recommended_at: '2026-10-26T08:30:00+09:00',
  condition: {
    tpo_cd: 'daily',
    tpo_text: null,
    season_cd: 'fall',
    going_out_start_at: '2026-10-26T09:00:00+09:00',
    going_out_end_at: '2026-10-26T14:00:00+09:00',
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
  outfit: {
    outfit_type_cd: 'preferred',
    reason: null,
    items: [],
  },
};

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

const useRatingError = (status: number, code: string, message: string) => {
  server.use(
    http.post(`${SESSION_URL}/rating`, () =>
      HttpResponse.json({ code, message }, { status }),
    ),
  );
};

const useRatingSuccess = () => {
  const requests: unknown[] = [];

  server.use(
    http.post(`${SESSION_URL}/rating`, async ({ request }) => {
      requests.push(await request.json());

      return HttpResponse.json({
        recommendation_session_id: SESSION_ID,
        outfit_id: 51,
        rating: 4,
        session_status_cd: 'completed',
      });
    }),
    http.get(HISTORY_URL, () => HttpResponse.json(historyDetail)),
  );

  return requests;
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

// 메모리 히스토리는 뒤로 가기에 차단을 걸지 않아서, 나가기 동작은 브라우저 히스토리로 확인한다.
const browserHistories: RouterHistory[] = [];

const renderResultAfterInput = async () => {
  window.history.replaceState(null, '', INPUT_PATH);
  const history = createBrowserHistory();
  browserHistories.push(history);
  history.push(RESULT_PATH);
  await Promise.resolve();

  return renderResult(history);
};

afterEach(() => {
  sessionStorage.clear();
  browserHistories.splice(0).forEach((history) => {
    history.destroy();
  });
  window.history.replaceState(null, '', '/');
});

// 재조회가 끝나도 화면 반영은 스케줄되어 있어서, 그려질 틈을 준 뒤 확인한다.
const refetchAndRender = async (queryClient: QueryClient) => {
  await act(async () => {
    await queryClient.refetchQueries();
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  });
};

type LatestRegeneration = NonNullable<
  RecommendationResult['latest_regeneration']
>;

const createRegeneration = (
  overrides: Partial<LatestRegeneration> = {},
): LatestRegeneration => ({
  request_seq: 1,
  regeneration_status_cd: 'processing',
  target_scope_cd: 'single',
  target_outfit_id: 51,
  target_slot_cd: null,
  ...overrides,
});

const useRegenerationSpy = () => {
  const requests: unknown[] = [];

  server.use(
    http.post(`${SESSION_URL}/regenerations`, async ({ request }) => {
      requests.push(await request.json());

      return HttpResponse.json(
        {
          recommendation_session_id: SESSION_ID,
          regeneration_request_id: 1,
          request_seq: 1,
          regeneration_status_cd: 'processing',
        },
        { status: 202 },
      );
    }),
  );

  return requests;
};

const useRegenerationError = (
  status: number,
  code: string,
  message: string,
) => {
  server.use(
    http.post(`${SESSION_URL}/regenerations`, () =>
      HttpResponse.json({ code, message }, { status }),
    ),
  );
};

const openRequestSheet = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('button', { name: '수정 요청하기' }),
  );

  return screen.findByRole('dialog', { name: '어떻게 바꿔 드릴까요' });
};

const submitRequest = async (
  user: ReturnType<typeof userEvent.setup>,
  sheet: HTMLElement,
  text = '좀 더 캐주얼하게',
) => {
  await user.type(
    within(sheet).getByRole('textbox', { name: '수정 요청 내용' }),
    text,
  );
  await user.click(
    within(sheet).getByRole('button', { name: '수정 요청하기' }),
  );
};

const openInfoSheet = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: '정보 확인' }));

  return screen.findByRole('dialog', { name: '코디 정보' });
};

const openRatingDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: '채택하기' }));

  return screen.findByRole('dialog', {
    name: '이 코디, 얼마나 마음에 드세요',
  });
};

const submitRating = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await openRatingDialog(user);

  await user.click(within(dialog).getByRole('radio', { name: '별 4개' }));
  await user.click(within(dialog).getByRole('button', { name: '채택하기' }));

  return dialog;
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

  test('사진이 있는 에센셜은 바닥에 놓아야 한다.', async () => {
    useResult(
      createResult({
        outfits: [
          createOutfit(1, {
            items: [
              createItem('bottom', '기본 하의', {
                item_source_cd: 'essential',
              }),
            ],
          }),
        ],
      }),
    );
    await renderResult();

    expect(await screen.findByAltText('기본 하의')).toBeInTheDocument();
  });

  test('이미지가 없는 아이템은 바닥에서 빼야 한다.', async () => {
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

  test('옷 부족 안내의 옷 등록은 그만두기 확인을 거쳐 옷장으로 보내야 한다.', async () => {
    const user = userEvent.setup();
    const cancelRequests = useCancelSpy();
    useResult(createResult({ is_clothing_shortage: true }));
    const { router } = await renderResult();

    const sheet = await openInfoSheet(user);
    await user.click(within(sheet).getByRole('button', { name: '옷 등록' }));

    const leaveDialog = await screen.findByRole('dialog', {
      name: '추천을 그만둘까요?',
    });
    await user.click(
      within(leaveDialog).getByRole('button', { name: '그만두기' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/closet');
    });
    expect(cancelRequests).toHaveLength(1);
  });

  test('서랍의 채택하기를 누르면 서랍을 닫고 별점 모달을 띄워야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResult();

    const sheet = await openInfoSheet(user);
    await user.click(within(sheet).getByRole('button', { name: '채택하기' }));

    expect(
      await screen.findByRole('dialog', {
        name: '이 코디, 얼마나 마음에 드세요',
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '코디 정보' }),
      ).not.toBeInTheDocument();
    });
  });
});

describe('채택', () => {
  test('별점을 고르기 전에는 채택하기가 비활성이어야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResult();

    const dialog = await openRatingDialog(user);

    expect(
      within(dialog).getByRole('button', { name: '채택하기' }),
    ).toBeDisabled();
  });

  test('다시 볼게요를 누르면 모달을 닫고 결과 화면에 남아야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    const { router } = await renderResult();

    const dialog = await openRatingDialog(user);
    await user.click(
      within(dialog).getByRole('button', { name: '다시 볼게요' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe(RESULT_PATH);
  });

  test('채택하면 보던 코디와 별점을 보내고 채택 완료 화면으로 이동해야 한다.', async () => {
    const user = userEvent.setup();
    const requests = useRatingSuccess();
    useResult(createResult());
    const { router } = await renderResult();

    await submitRating(user);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADOPTED_PATH);
    });
    expect(requests).toEqual([{ outfit_id: 51, rating: 4 }]);
    expect(
      await screen.findByText('오늘의 코디로 채택했어요'),
    ).toBeInTheDocument();
  });

  test('채택 뒤 내역을 받는 동안에는 다시 제출할 수 없어야 한다.', async () => {
    const user = userEvent.setup();
    const requests = useRatingSuccess();
    let finishHistory = () => {};
    server.use(
      http.get(HISTORY_URL, async () => {
        await new Promise<void>((resolve) => {
          finishHistory = resolve;
        });

        return HttpResponse.json(historyDetail);
      }),
    );
    useResult(createResult());
    const { router } = await renderResult();

    const dialog = await submitRating(user);

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    await user.click(within(dialog).getByRole('button', { name: '채택하기' }));

    expect(
      within(dialog).getByRole('button', { name: '다시 볼게요' }),
    ).toBeDisabled();
    expect(requests).toHaveLength(1);

    await waitFor(() => {
      finishHistory();
      expect(router.state.location.pathname).toBe(ADOPTED_PATH);
    });
  });

  test('채택이 실패하면 모달과 별점을 유지하고 오류 토스트를 띄워야 한다.', async () => {
    const user = userEvent.setup();
    useRatingError(500, 'SERVER_ERROR', '서버에 연결할 수 없습니다.');
    useResult(createResult());
    await renderResult();

    const dialog = await submitRating(user);

    const toast = await screen.findByRole('alert');
    expect(
      within(toast).getByText('코디를 채택하지 못했어요'),
    ).toBeInTheDocument();
    expect(
      within(toast).getByText('서버에 연결할 수 없습니다.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: '별 4개' })).toBeChecked();
  });

  test('세션이 끝나 거절되면 세션 종료 안내를 띄워야 한다.', async () => {
    const user = userEvent.setup();
    useRatingError(
      409,
      'SESSION_NOT_RATABLE',
      '별점을 매길 수 없는 세션입니다.',
    );
    useResult(createResult());
    await renderResult();

    await submitRating(user);

    expect(
      await screen.findByRole('dialog', { name: '추천이 끝났어요' }),
    ).toBeInTheDocument();
  });

  test('이미 채택되어 거절되면 볼 수 없는 추천 화면을 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    useRatingError(
      409,
      'SESSION_ALREADY_SETTLED',
      '이미 별점을 매겨 끝난 추천입니다.',
    );
    useResult(createResult());
    await renderResult();

    await submitRating(user);

    expect(
      await screen.findByText('볼 수 없는 추천이에요'),
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

  test('보던 중 세션이 끝나면 받아 둔 코디 위에 종료 안내를 띄워야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    const { router, queryClient } = await renderResult();

    await screen.findByAltText('1번 상의');
    useResult(createResult({ session_status_cd: 'abandoned', outfits: [] }));
    await queryClient.refetchQueries();

    const dialog = await screen.findByRole('dialog', {
      name: '추천이 끝났어요',
    });
    expect(screen.getByAltText('1번 상의')).toBeInTheDocument();

    await refetchAndRender(queryClient);

    expect(screen.getByAltText('1번 상의')).toBeInTheDocument();
    expect(screen.queryByText('볼 수 없는 추천이에요')).not.toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: '새로 추천받기' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(INPUT_PATH);
    });
  });
});

describe('나가기', () => {
  test('그만두는 사이에 재조회가 와도 세션 종료 안내를 띄우지 않아야 한다.', async () => {
    const user = userEvent.setup();
    let finishCancel = () => {};
    server.use(
      http.post(`${SESSION_URL}/cancel`, async () => {
        await new Promise<void>((resolve) => {
          finishCancel = resolve;
        });

        return HttpResponse.json({
          recommendation_session_id: SESSION_ID,
          session_status_cd: 'canceled',
        });
      }),
    );
    useResult(createResult());
    const { router, queryClient } = await renderResult();

    await screen.findByAltText('1번 상의');
    await user.click(screen.getByRole('button', { name: '추천 그만두기' }));
    const dialog = await screen.findByRole('dialog', {
      name: '추천을 그만둘까요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '그만두기' }));
    useResult(createResult({ session_status_cd: 'canceled', outfits: [] }));
    await refetchAndRender(queryClient);

    expect(
      screen.queryByRole('dialog', { name: '추천이 끝났어요' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      finishCancel();
      expect(router.state.location.pathname).toBe(INPUT_PATH);
    });
  });

  test('불러오기 실패에서 돌아가는 중에 뒤로 가기를 눌러도 그만두기 확인을 띄우지 않아야 한다.', async () => {
    const user = userEvent.setup();
    let finishCancel = () => {};
    server.use(
      http.post(`${SESSION_URL}/cancel`, async () => {
        await new Promise<void>((resolve) => {
          finishCancel = resolve;
        });

        return HttpResponse.json({
          recommendation_session_id: SESSION_ID,
          session_status_cd: 'canceled',
        });
      }),
    );
    useErrorResult(500);
    const { router } = await renderResultAfterInput();

    await user.click(await screen.findByRole('button', { name: '돌아가기' }));
    window.history.back();
    await waitFor(() => {
      expect(window.location.pathname).toBe(RESULT_PATH);
    });

    expect(
      screen.queryByRole('dialog', { name: '추천을 그만둘까요?' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      finishCancel();
      expect(router.state.location.pathname).toBe(INPUT_PATH);
    });
  });

  test('옷 등록으로 연 확인에서 뒤로 가기를 눌러도 옷장으로 가야 한다.', async () => {
    const user = userEvent.setup();
    useCancelSpy();
    useResult(createResult({ is_clothing_shortage: true }));
    const { router } = await renderResultAfterInput();

    const sheet = await openInfoSheet(user);
    await user.click(within(sheet).getByRole('button', { name: '옷 등록' }));
    const dialog = await screen.findByRole('dialog', {
      name: '추천을 그만둘까요?',
    });
    window.history.back();
    await waitFor(() => {
      expect(window.location.pathname).toBe(RESULT_PATH);
    });
    await user.click(within(dialog).getByRole('button', { name: '그만두기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/closet');
    });
  });

  test('X를 누르면 그만두기 확인을 띄우고, 그만두면 세션을 취소해야 한다.', async () => {
    const user = userEvent.setup();
    const cancelRequests = useCancelSpy();
    useResult(createResult());
    const { router } = await renderResult();

    await screen.findByAltText('1번 상의');
    await user.click(screen.getByRole('button', { name: '추천 그만두기' }));
    const dialog = await screen.findByRole('dialog', {
      name: '추천을 그만둘까요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '그만두기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(INPUT_PATH);
    });
    expect(cancelRequests).toHaveLength(1);
  });

  test('계속 보기를 누르면 세션을 취소하지 않고 결과 화면에 남아야 한다.', async () => {
    const user = userEvent.setup();
    const cancelRequests = useCancelSpy();
    useResult(createResult());
    const { router } = await renderResult();

    await screen.findByAltText('1번 상의');
    await user.click(screen.getByRole('button', { name: '추천 그만두기' }));
    const dialog = await screen.findByRole('dialog', {
      name: '추천을 그만둘까요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '계속 보기' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(cancelRequests).toHaveLength(0);
    expect(router.state.location.pathname).toBe(RESULT_PATH);
  });

  test('뒤로 가기를 누르면 그만두기 확인을 띄우고 결과 화면에 남아야 한다.', async () => {
    useResult(createResult());
    const { router } = await renderResultAfterInput();

    await screen.findByAltText('1번 상의');
    window.history.back();

    expect(
      await screen.findByRole('dialog', { name: '추천을 그만둘까요?' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(RESULT_PATH);
  });

  test('서랍이 열린 상태의 뒤로 가기는 서랍만 닫고, 한 번 더 누르면 그만두기 확인을 띄워야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResultAfterInput();

    await openInfoSheet(user);
    window.history.back();

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '코디 정보' }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole('dialog', { name: '추천을 그만둘까요?' }),
    ).not.toBeInTheDocument();

    window.history.back();

    expect(
      await screen.findByRole('dialog', { name: '추천을 그만둘까요?' }),
    ).toBeInTheDocument();
  });

  test('별점 모달이 열린 상태의 뒤로 가기는 모달만 닫아야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResultAfterInput();

    await openRatingDialog(user);
    window.history.back();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('재추천 요청 시트', () => {
  test('대상 선택에 실제 벌 수를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    useResult(
      createResult({
        outfits: [createOutfit(1), createOutfit(2), createOutfit(3)],
      }),
    );
    await renderResult();

    const sheet = await openRequestSheet(user);

    expect(
      within(sheet).getByRole('button', { name: '이 세트만' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(sheet).getByRole('button', { name: '3세트 전부' }),
    ).toBeInTheDocument();
  });

  test.each(['', '   '])(
    '입력란이 "%s"이면 시트의 버튼을 막아야 한다.',
    async (text) => {
      const user = userEvent.setup();
      useResult(createResult());
      await renderResult();

      const sheet = await openRequestSheet(user);
      const button = within(sheet).getByRole('button', {
        name: '수정 요청하기',
      });

      if (text) {
        await user.type(
          within(sheet).getByRole('textbox', { name: '수정 요청 내용' }),
          text,
        );
      }

      expect(button).toBeDisabled();
    },
  );

  test('코디가 1벌이면 대상 선택을 숨겨야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult({ outfits: [createOutfit(1)] }));
    await renderResult();

    const sheet = await openRequestSheet(user);

    expect(
      within(sheet).queryByRole('button', { name: '이 세트만' }),
    ).not.toBeInTheDocument();
  });

  test('이 세트만 고르면 보던 코디를 대상으로 보내야 한다.', async () => {
    const user = userEvent.setup();
    const requests = useRegenerationSpy();
    useResult(createResult());
    await renderResult();

    await submitRequest(user, await openRequestSheet(user));

    await waitFor(() => {
      expect(requests).toEqual([
        {
          request_text: '좀 더 캐주얼하게',
          target_scope_cd: 'single',
          target_outfit_id: 51,
        },
      ]);
    });
  });

  test('전부를 고르면 대상 코디 없이 보내야 한다.', async () => {
    const user = userEvent.setup();
    const requests = useRegenerationSpy();
    useResult(createResult());
    await renderResult();

    const sheet = await openRequestSheet(user);
    await user.click(within(sheet).getByRole('button', { name: '2세트 전부' }));
    await submitRequest(user, sheet);

    await waitFor(() => {
      expect(requests).toEqual([
        {
          request_text: '좀 더 캐주얼하게',
          target_scope_cd: 'all',
          target_outfit_id: null,
        },
      ]);
    });
  });

  test('서랍의 수정 요청하기로도 시트를 열어야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResult();

    const infoSheet = await openInfoSheet(user);
    await user.click(
      within(infoSheet).getByRole('button', { name: '수정 요청하기' }),
    );

    expect(
      await screen.findByRole('dialog', { name: '어떻게 바꿔 드릴까요' }),
    ).toBeInTheDocument();
  });

  test('요청이 거절되면 시트를 유지하고 서버 문구를 입력란에 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    useRegenerationError(
      422,
      'REGENERATION_REQUEST_UNCLEAR',
      '요청을 이해하지 못했습니다. 다시 말씀해 주세요.',
    );
    useResult(createResult());
    await renderResult();

    const sheet = await openRequestSheet(user);
    await submitRequest(user, sheet);

    expect(
      await within(sheet).findByText(
        '요청을 이해하지 못했습니다. 다시 말씀해 주세요.',
      ),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole('textbox', { name: '수정 요청 내용' }),
    ).toHaveValue('좀 더 캐주얼하게');

    await user.type(
      within(sheet).getByRole('textbox', { name: '수정 요청 내용' }),
      '요',
    );

    expect(
      within(sheet).queryByText(
        '요청을 이해하지 못했습니다. 다시 말씀해 주세요.',
      ),
    ).not.toBeInTheDocument();
  });

  test('세션이 끝나 거절되면 세션 종료 안내를 띄워야 한다.', async () => {
    const user = userEvent.setup();
    useRegenerationError(
      409,
      'SESSION_ENDED',
      '이미 끝난 추천입니다. 새로 추천을 받아 주세요.',
    );
    useResult(createResult());
    await renderResult();

    await submitRequest(user, await openRequestSheet(user));

    expect(
      await screen.findByRole('dialog', { name: '추천이 끝났어요' }),
    ).toBeInTheDocument();
  });

  test('이미 채택되어 거절되면 볼 수 없는 추천 화면을 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    useRegenerationError(
      409,
      'SESSION_ALREADY_SETTLED',
      '이미 별점을 매겨 끝난 추천입니다.',
    );
    useResult(createResult());
    await renderResult();

    await submitRequest(user, await openRequestSheet(user));

    expect(
      await screen.findByText('볼 수 없는 추천이에요'),
    ).toBeInTheDocument();
  });

  test('시트가 열린 상태의 뒤로 가기는 시트만 닫아야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResultAfterInput();

    await openRequestSheet(user);
    window.history.back();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe(RESULT_PATH);
    });
  });
});

describe('재추천 진행 표시', () => {
  test('요청을 보내면 시트를 닫고 대상 카드에 덮개를 씌워야 한다.', async () => {
    const user = userEvent.setup();
    useRegenerationSpy();
    useResult(createResult());
    await renderResult();

    const sheet = await openRequestSheet(user);
    useResult(createResult({ latest_regeneration: createRegeneration() }));
    await submitRequest(user, sheet);

    expect(
      await screen.findByText('요청을 반영하는 중이에요'),
    ).toBeInTheDocument();
    expect(screen.getByText('길게는 3분까지 걸려요')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '어떻게 바꿔 드릴까요' }),
      ).not.toBeInTheDocument();
    });
  });

  test('대상 카드에서는 세 버튼을 모두 막아야 한다.', async () => {
    useResult(createResult({ latest_regeneration: createRegeneration() }));
    await renderResult();

    expect(
      await screen.findByRole('button', { name: '정보 확인' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: '채택하기' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '수정 요청하기' }),
    ).toBeDisabled();
  });

  test('다른 세트를 재추천하는 중이면 수정 요청만 막아야 한다.', async () => {
    useResult(
      createResult({
        latest_regeneration: createRegeneration({ target_outfit_id: 52 }),
      }),
    );
    await renderResult();

    expect(
      await screen.findByRole('button', { name: '채택하기' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: '정보 확인' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: '수정 요청하기' }),
    ).toBeDisabled();
  });

  test('다른 세트를 재추천하는 중이면 서랍의 수정 요청도 막아야 한다.', async () => {
    const user = userEvent.setup();
    useResult(
      createResult({
        latest_regeneration: createRegeneration({ target_outfit_id: 52 }),
      }),
    );
    await renderResult();

    await user.click(await screen.findByRole('button', { name: '정보 확인' }));

    const sheet = await screen.findByRole('dialog', { name: '코디 정보' });

    expect(
      within(sheet).getByRole('button', { name: '수정 요청하기' }),
    ).toBeDisabled();
  });

  test('전체 재추천이면 모든 카드에 덮개를 씌워야 한다.', async () => {
    useResult(
      createResult({
        latest_regeneration: createRegeneration({
          target_scope_cd: 'all',
          target_outfit_id: null,
        }),
      }),
    );
    await renderResult();

    expect(await screen.findAllByText('요청을 반영하는 중이에요')).toHaveLength(
      2,
    );
  });

  test('재추천이 끝나면 덮개를 걷어야 한다.', async () => {
    useResult(createResult({ latest_regeneration: createRegeneration() }));
    const { queryClient } = await renderResult();

    await screen.findByText('요청을 반영하는 중이에요');
    useResult(
      createResult({
        latest_regeneration: createRegeneration({
          regeneration_status_cd: 'completed',
        }),
      }),
    );
    await refetchAndRender(queryClient);

    expect(
      screen.queryByText('요청을 반영하는 중이에요'),
    ).not.toBeInTheDocument();
  });
});

describe('재추천 실패 안내', () => {
  const failedResult = () =>
    createResult({
      latest_regeneration: createRegeneration({
        regeneration_status_cd: 'failed',
      }),
    });

  test('실패하면 기존 코디를 유지했다고 알려야 한다.', async () => {
    useResult(failedResult());
    await renderResult();

    const toast = await screen.findByRole('alert');

    expect(
      within(toast).getByText('요청을 반영하지 못했어요'),
    ).toBeInTheDocument();
    expect(
      within(toast).getByText('기존 코디를 유지했어요.'),
    ).toBeInTheDocument();
    expect(
      sessionStorage.getItem(REGENERATION_FAILURE_NOTICE_STORAGE_KEY),
    ).toBe(JSON.stringify({ sessionId: SESSION_ID, requestSeq: 1 }));
  });

  test('이미 알린 요청은 새로고침해도 다시 알리지 않아야 한다.', async () => {
    sessionStorage.setItem(
      REGENERATION_FAILURE_NOTICE_STORAGE_KEY,
      JSON.stringify({ sessionId: SESSION_ID, requestSeq: 1 }),
    );
    useResult(failedResult());
    await renderResult();

    await screen.findByAltText('1번 상의');

    expect(
      screen.queryByText('요청을 반영하지 못했어요'),
    ).not.toBeInTheDocument();
  });
});

describe('이전 코디', () => {
  const createPreviousOutfit = (outfitId: number, itemName: string) => ({
    outfit_id: outfitId,
    outfit_seq: 1,
    outfit_type_cd: 'preferred' as const,
    reason: null,
    items: [createItem('top', itemName)],
  });

  const createResultWithHistory = () =>
    createResult({
      outfits: [
        createOutfit(1, {
          outfit_id: 61,
          previous_outfits: [createPreviousOutfit(51, '처음 상의')],
        }),
        createOutfit(2),
      ],
    });

  const openPreviousOutfit = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    await user.click(
      await screen.findByRole('button', { name: '이전 코디 보기' }),
    );
  };

  test('보는 동안 수정 요청만 막고 채택과 정보 확인은 둬야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResultWithHistory());
    await renderResult();

    await openPreviousOutfit(user);

    expect(screen.getByText('1번째 추천')).toBeVisible();
    expect(
      screen.getByRole('button', { name: '수정 요청하기' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: '채택하기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '정보 확인' })).toBeEnabled();
  });

  test('서랍에는 이전 코디를 보여 주고 수정 요청을 막아야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResultWithHistory());
    await renderResult();

    await openPreviousOutfit(user);
    await user.click(screen.getByRole('button', { name: '정보 확인' }));

    const sheet = await screen.findByRole('dialog', { name: '코디 정보' });

    expect(within(sheet).getByText('처음 상의')).toBeInTheDocument();
    expect(
      within(sheet).getByRole('button', { name: '수정 요청하기' }),
    ).toBeDisabled();
  });

  test('채택하면 보던 이전 코디를 보내야 한다.', async () => {
    const user = userEvent.setup();
    const requests = useRatingSuccess();
    useResult(createResultWithHistory());
    await renderResult();

    await openPreviousOutfit(user);
    await submitRating(user);

    await waitFor(() => {
      expect(requests).toEqual([{ outfit_id: 51, rating: 4 }]);
    });
  });

  test('최신으로 돌아오면 다시 수정을 요청할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResultWithHistory());
    await renderResult();

    await openPreviousOutfit(user);
    await user.click(
      screen.getByRole('button', { name: '최신 쪽으로 돌아가기' }),
    );

    expect(screen.getByText('이전 코디 1')).toBeVisible();
    expect(screen.getByRole('button', { name: '수정 요청하기' })).toBeEnabled();
  });

  test('이 세트의 재추천이 끝나면 최신으로 돌아와야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResultWithHistory());
    const { queryClient } = await renderResult();

    await openPreviousOutfit(user);
    useResult(
      createResult({
        outfits: [
          createOutfit(1, {
            outfit_id: 71,
            previous_outfits: [
              createPreviousOutfit(61, '두 번째 상의'),
              createPreviousOutfit(51, '처음 상의'),
            ],
          }),
          createOutfit(2),
        ],
      }),
    );
    await refetchAndRender(queryClient);

    expect(screen.getByText('이전 코디 2')).toBeVisible();
    expect(screen.getByRole('button', { name: '수정 요청하기' })).toBeEnabled();
  });
});

describe('다른 세트의 재추천 완료 안내', () => {
  const createCompletedResult = (targetSeq: number) => {
    const targetOutfitId = 50 + targetSeq;

    return createResult({
      outfits: [createOutfit(1), createOutfit(2)].map((outfit) =>
        outfit.outfit_seq === targetSeq
          ? {
              ...outfit,
              outfit_id: 70 + targetSeq,
              previous_outfits: [
                {
                  outfit_id: targetOutfitId,
                  outfit_seq: targetSeq,
                  outfit_type_cd: outfit.outfit_type_cd,
                  reason: null,
                  items: outfit.items,
                },
              ],
            }
          : outfit,
      ),
      latest_regeneration: createRegeneration({
        regeneration_status_cd: 'completed',
        target_outfit_id: targetOutfitId,
      }),
    });
  };

  test('다른 세트를 보던 중 끝나면 몇 번째 코디인지 알려야 한다.', async () => {
    useResult(
      createResult({
        latest_regeneration: createRegeneration({ target_outfit_id: 52 }),
      }),
    );
    const { queryClient } = await renderResult();

    await screen.findByRole('button', { name: '채택하기' });
    useResult(createCompletedResult(2));
    await refetchAndRender(queryClient);

    expect(
      await screen.findByText('2번째 코디에 요청을 반영했어요'),
    ).toBeInTheDocument();
  });

  test('보던 세트의 재추천이 끝나면 안내하지 않아야 한다.', async () => {
    useResult(createResult({ latest_regeneration: createRegeneration() }));
    const { queryClient } = await renderResult();

    await screen.findByRole('button', { name: '채택하기' });
    useResult(createCompletedResult(1));
    await refetchAndRender(queryClient);

    expect(
      screen.queryByText(/코디에 요청을 반영했어요/),
    ).not.toBeInTheDocument();
  });

  test('이미 끝난 재추천은 다시 들어와도 안내하지 않아야 한다.', async () => {
    useResult(createCompletedResult(2));
    await renderResult();

    await screen.findByRole('button', { name: '채택하기' });

    expect(
      screen.queryByText(/코디에 요청을 반영했어요/),
    ).not.toBeInTheDocument();
  });

  test('전체 재추천이 끝나면 안내하지 않아야 한다.', async () => {
    useResult(
      createResult({
        latest_regeneration: createRegeneration({
          target_scope_cd: 'all',
          target_outfit_id: null,
        }),
      }),
    );
    const { queryClient } = await renderResult();

    await screen.findAllByText('요청을 반영하는 중이에요');
    useResult(
      createResult({
        latest_regeneration: createRegeneration({
          regeneration_status_cd: 'completed',
          target_scope_cd: 'all',
          target_outfit_id: null,
        }),
      }),
    );
    await refetchAndRender(queryClient);

    expect(
      screen.queryByText(/코디에 요청을 반영했어요/),
    ).not.toBeInTheDocument();
  });
});

describe('세션 종료 안내의 사유', () => {
  test.each([
    {
      statusCd: 'canceled' as const,
      notice: /다른 화면에서 추천을 그만뒀어요/,
    },
    {
      statusCd: 'abandoned' as const,
      notice: /30분 동안 아무 동작이 없어 끝났어요/,
    },
  ])('$statusCd이면 그 사유를 알려야 한다.', async ({ statusCd, notice }) => {
    useResult(createResult());
    const { queryClient } = await renderResult();

    await screen.findByRole('button', { name: '채택하기' });
    useResult(createResult({ session_status_cd: statusCd, outfits: [] }));
    await refetchAndRender(queryClient);

    expect(
      within(
        await screen.findByRole('dialog', { name: '추천이 끝났어요' }),
      ).getByText(notice),
    ).toBeInTheDocument();
  });
});

describe('불러오기 실패의 다시 시도', () => {
  test.each([500, 503])(
    '%i이면 다시 시도할 수 있어야 한다.',
    async (status) => {
      useErrorResult(status);
      await renderResult();

      expect(
        await screen.findByRole('button', { name: '다시 시도' }),
      ).toBeInTheDocument();
    },
  );

  test('네트워크 오류면 다시 시도할 수 있어야 한다.', async () => {
    server.use(http.get(SESSION_URL, () => HttpResponse.error()));
    await renderResult();

    expect(
      await screen.findByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument();
  });

  test.each([400, 403, 409])(
    '%i이면 다시 시도 없이 볼 수 없는 추천으로 안내해야 한다.',
    async (status) => {
      useErrorResult(status);
      await renderResult();

      expect(
        await screen.findByText('볼 수 없는 추천이에요'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '다시 시도' }),
      ).not.toBeInTheDocument();
    },
  );
});

describe('거절된 세션의 종료 사유', () => {
  test('재조회로 취소를 확인하면 그만뒀다고 알려야 한다.', async () => {
    const user = userEvent.setup();
    useRatingError(
      409,
      'SESSION_NOT_RATABLE',
      '별점을 매길 수 없는 세션입니다.',
    );
    useResult(createResult());
    await renderResult();

    const dialog = await openRatingDialog(user);

    useResult(createResult({ session_status_cd: 'canceled', outfits: [] }));
    await user.click(within(dialog).getByRole('radio', { name: '별 4개' }));
    await user.click(within(dialog).getByRole('button', { name: '채택하기' }));

    expect(
      within(
        await screen.findByRole('dialog', { name: '추천이 끝났어요' }),
      ).getByText(/다른 화면에서 추천을 그만뒀어요/),
    ).toBeInTheDocument();
  });

  test('재조회가 실패하면 30분 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    useRatingError(
      409,
      'SESSION_NOT_RATABLE',
      '별점을 매길 수 없는 세션입니다.',
    );
    useResult(createResult());
    await renderResult();

    const dialog = await openRatingDialog(user);

    useErrorResult(500);
    await user.click(within(dialog).getByRole('radio', { name: '별 4개' }));
    await user.click(within(dialog).getByRole('button', { name: '채택하기' }));

    expect(
      within(
        await screen.findByRole('dialog', { name: '추천이 끝났어요' }),
      ).getByText(/30분 동안 아무 동작이 없어 끝났어요/),
    ).toBeInTheDocument();
  });
});

describe('서랍의 사진 실패', () => {
  test('불러오지 못한 사진 칸에도 이름을 남겨야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResult();

    const sheet = await openInfoSheet(user);
    const [image] = within(sheet).getAllByRole('presentation');

    fireEvent.error(image);

    expect(within(sheet).getByText('1번 상의')).toBeInTheDocument();
    expect(within(sheet).getAllByRole('presentation')).toHaveLength(2);
  });

  test('서랍을 다시 열면 사진을 다시 요청해야 한다.', async () => {
    const user = userEvent.setup();
    useResult(createResult());
    await renderResult();

    const sheet = await openInfoSheet(user);

    fireEvent.error(within(sheet).getAllByRole('presentation')[0]);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '코디 정보' }),
      ).not.toBeInTheDocument();
    });

    expect(
      within(await openInfoSheet(user)).getAllByRole('presentation'),
    ).toHaveLength(3);
  });
});
