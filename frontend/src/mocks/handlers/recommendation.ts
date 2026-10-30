import { http, HttpResponse } from 'msw';
import type {
  CancelResult,
  ClothingShortagePrecheckResponse,
  OutfitItemResult,
  OutfitResult,
  RegenerationCreateOutput,
  RatingResult,
  RecommendationHistoryDetail,
  RecommendationResult,
  RegenerationCreated,
  RecommendationSessionCreated,
  RecommendationSessionCreateOutput,
} from '@/generated/models';
import {
  RatingCreate,
  RecommendationSessionCreate,
  RegenerationCreate,
} from '@/generated/models';

interface SessionParams {
  sessionId: string;
}

interface MockRegeneration {
  requestSeq: number;
  targetScopeCd: RegenerationCreateOutput['target_scope_cd'];
  targetOutfitId: number | null;
  startedAt: number;
  willFail: boolean;
  isSettled: boolean;
}

interface MockSession {
  request: RecommendationSessionCreateOutput | null;
  createdAt: number;
  sessionStatusCd: RecommendationResult['session_status_cd'];
  rated?: { outfitId: number; rating: number };
  outfits?: OutfitResult[];
  regeneration?: MockRegeneration;
}

// 직접 입력에 이 말을 넣으면 생성이 실패하는 세션을 만든다. 새로고침해도 알 수 있게 번호로 구분한다.
const FAILURE_KEYWORD = '실패';
const FIRST_FAILED_SESSION_ID = 9001;
// 진행 화면과 취소를 dev:mock에서 직접 해 볼 수 있도록 생성에 몇 초가 걸리는 것처럼 둔다.
const GENERATION_MS = 6000;
const OUTFIT_COUNT = 4;
const DEFAULT_MOCK_RATING = 4;
const REGENERATION_MS = 5000;
const REGENERATION_MAX_LENGTH = 300;
const FIRST_REGENERATED_OUTFIT_ID = 90001;
// 재추천 요청 문구에 이 말을 넣으면 그 응답을 dev:mock에서 볼 수 있다.
const REGENERATION_KEYWORD = {
  FAILURE: '실패',
  UNCLEAR: '모르겠어',
  UNAVAILABLE: '점검',
  SESSION_ENDED: '끝난세션',
} as const;
const SAMPLE_CUTOUT_URL = '/media/clothing/1/sample_cutout.webp';
// 직접 입력에 이 말을 넣으면 결과 화면의 해당 상태를 dev:mock에서 볼 수 있다.
const RESULT_KEYWORD = {
  SINGLE_OUTFIT: '한벌',
  ESSENTIAL_ONLY: '에센셜',
  CLOTHING_SHORTAGE: '옷부족',
  ESTIMATED_WEATHER: '추정',
  NO_REASON: '이유없음',
  RATING_FAILURE: '채택오류',
  RATING_EXPIRED: '시간끝',
  RATING_SETTLED: '이미채택',
} as const;

const sessions = new Map<number, MockSession>();
let nextSessionId = 1;
let nextFailedSessionId = FIRST_FAILED_SESSION_ID;
let nextRegeneratedOutfitId = FIRST_REGENERATED_OUTFIT_ID;

export const resetRecommendationMocks = () => {
  sessions.clear();
  nextSessionId = 1;
  nextFailedSessionId = FIRST_FAILED_SESSION_ID;
  nextRegeneratedOutfitId = FIRST_REGENERATED_OUTFIT_ID;
};

// 새로고침하면 MSW 상태가 사라지므로, 모르는 세션은 처음 만든 것처럼 다룬다.
const getSession = (sessionId: number) => {
  const session = sessions.get(sessionId) ?? {
    request: null,
    createdAt: Date.now(),
    sessionStatusCd: 'active',
  };
  sessions.set(sessionId, session);

  return session;
};

const getGenerationStatusCd = (
  sessionId: number,
  session: MockSession,
): RecommendationResult['generation_status_cd'] => {
  if (session.sessionStatusCd === 'canceled') {
    return 'failed';
  }

  if (Date.now() - session.createdAt < GENERATION_MS) {
    return 'processing';
  }

  return sessionId >= FIRST_FAILED_SESSION_ID ? 'failed' : 'completed';
};

const hasKeyword = (session: MockSession | undefined, keyword: string) =>
  session?.request?.tpo_text?.includes(keyword) ?? false;

const createItem = (
  slotCd: OutfitItemResult['slot_cd'],
  itemName: string,
  overrides: Partial<OutfitItemResult> = {},
): OutfitItemResult => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: itemName,
  image_url: SAMPLE_CUTOUT_URL,
  style_cds: ['minimal', 'casual'],
  ...overrides,
});

const createEssentialItem = (
  slotCd: OutfitItemResult['slot_cd'],
  itemName: string,
) =>
  createItem(slotCd, itemName, {
    item_source_cd: 'essential',
    image_url: null,
    style_cds: [],
  });

const createOutfits = (
  sessionId: number,
  session: MockSession | undefined,
): OutfitResult[] => {
  const outfitCount = hasKeyword(session, RESULT_KEYWORD.SINGLE_OUTFIT)
    ? 1
    : OUTFIT_COUNT;
  const items = hasKeyword(session, RESULT_KEYWORD.ESSENTIAL_ONLY)
    ? [
        createEssentialItem('top', '흰 티셔츠'),
        createEssentialItem('bottom', '검정 슬랙스'),
        createEssentialItem('shoes', '흰 스니커즈'),
      ]
    : [
        createItem('top', '베이지 터틀넥'),
        createItem('bottom', '그레이 슬랙스'),
        createItem('shoes', '브라운 스니커즈'),
        createEssentialItem('socks', '흰 양말'),
        createItem('accessories', '네이비 볼캡', {
          accessory_type_cd: 'hat',
          style_cds: ['street'],
        }),
      ];

  return Array.from({ length: outfitCount }, (_, index) => ({
    outfit_id: sessionId * 10 + index + 1,
    outfit_seq: index + 1,
    outfit_type_cd: 'preferred',
    reason: hasKeyword(session, RESULT_KEYWORD.NO_REASON)
      ? null
      : '아침이 쌀쌀해 가벼운 아우터를 걸쳤어요.',
    items,
    previous_outfits: [],
  }));
};

const getSessionOutfits = (sessionId: number, session: MockSession) => {
  session.outfits ??= createOutfits(sessionId, session);

  return session.outfits;
};

const isRegenerationTarget = (
  regeneration: MockRegeneration,
  outfit: OutfitResult,
) =>
  regeneration.targetScopeCd === 'all' ||
  regeneration.targetOutfitId === outfit.outfit_id;

const regenerateOutfit = (outfit: OutfitResult): OutfitResult => {
  const { previous_outfits: previousOutfits, ...current } = outfit;

  return {
    ...outfit,
    outfit_id: nextRegeneratedOutfitId++,
    reason: '요청하신 대로 바꿔 봤어요.',
    previous_outfits: [current, ...previousOutfits],
  };
};

const settleRegeneration = (sessionId: number, session: MockSession) => {
  const { regeneration } = session;

  if (
    !regeneration ||
    regeneration.isSettled ||
    Date.now() - regeneration.startedAt < REGENERATION_MS
  ) {
    return;
  }

  regeneration.isSettled = true;

  if (!regeneration.willFail) {
    session.outfits = getSessionOutfits(sessionId, session).map((outfit) =>
      isRegenerationTarget(regeneration, outfit)
        ? regenerateOutfit(outfit)
        : outfit,
    );
  }
};

const toLatestRegeneration = (
  session: MockSession,
): RecommendationResult['latest_regeneration'] => {
  const { regeneration } = session;

  if (!regeneration || session.sessionStatusCd !== 'active') {
    return null;
  }

  const settledStatusCd = regeneration.willFail ? 'failed' : 'completed';

  return {
    request_seq: regeneration.requestSeq,
    regeneration_status_cd: regeneration.isSettled
      ? settledStatusCd
      : 'processing',
    target_scope_cd: regeneration.targetScopeCd,
    target_outfit_id: regeneration.targetOutfitId,
    target_slot_cd: null,
  };
};

const getWeather = (session: MockSession | undefined) => ({
  temperature: 14.2,
  feels_like_temperature: 12.8,
  weather_condition_cd: 'cloudy' as const,
  is_fallback: hasKeyword(session, RESULT_KEYWORD.ESTIMATED_WEATHER),
});

const getVisibleOutfits = (sessionId: number, session: MockSession) => {
  const outfits = getSessionOutfits(sessionId, session);

  if (session.sessionStatusCd === 'completed') {
    return outfits.filter(
      (outfit) => outfit.outfit_id === session.rated?.outfitId,
    );
  }

  return session.sessionStatusCd === 'active' ? outfits : [];
};

const toResult = (
  sessionId: number,
  session: MockSession,
): RecommendationResult => {
  settleRegeneration(sessionId, session);

  const generationStatusCd = getGenerationStatusCd(sessionId, session);
  const isCompleted = generationStatusCd === 'completed';

  return {
    recommendation_session_id: sessionId,
    generation_status_cd: generationStatusCd,
    session_status_cd: session.sessionStatusCd,
    is_clothing_shortage: hasKeyword(session, RESULT_KEYWORD.CLOTHING_SHORTAGE),
    condition: {
      tpo_cd: session.request?.tpo_cd ?? 'daily',
      tpo_text: session.request?.tpo_text ?? null,
      season_cd: 'fall',
      going_out_start_at: '2026-10-26T09:00:00+09:00',
      going_out_end_at: '2026-10-26T14:00:00+09:00',
    },
    weather: isCompleted ? getWeather(session) : null,
    outfits: isCompleted ? getVisibleOutfits(sessionId, session) : [],
    latest_regeneration: toLatestRegeneration(session),
  };
};

// 새로고침하면 MSW 상태가 사라지므로, 모르는 세션은 첫 코디에 별점을 매긴 것처럼 다룬다.
const toHistoryDetail = (
  sessionId: number,
  session: MockSession | undefined,
): RecommendationHistoryDetail => {
  const outfits = session
    ? getSessionOutfits(sessionId, session)
    : createOutfits(sessionId, session);
  const outfit =
    outfits.find(({ outfit_id: id }) => id === session?.rated?.outfitId) ??
    outfits[0];

  return {
    recommendation_session_id: sessionId,
    recommended_at: '2026-10-26T08:30:00+09:00',
    condition: {
      tpo_cd: session?.request?.tpo_cd ?? 'daily',
      tpo_text: session?.request?.tpo_text ?? null,
      season_cd: 'fall',
      going_out_start_at: '2026-10-26T09:00:00+09:00',
      going_out_end_at: '2026-10-26T14:00:00+09:00',
      sido_nm: '서울특별시',
      sigungu_nm: '성동구',
    },
    weather: { ...getWeather(session), precipitation: 0, wind_speed: 1.2 },
    rating: session?.rated?.rating ?? DEFAULT_MOCK_RATING,
    outfit: {
      outfit_type_cd: outfit.outfit_type_cd,
      reason: outfit.reason,
      items: outfit.items.map((item) => ({
        ...item,
        is_clothing_deleted: false,
      })),
    },
  };
};

export const recommendationHandlers = [
  http.get('/api/recommendations/precheck', () =>
    HttpResponse.json<ClothingShortagePrecheckResponse>({
      is_clothing_shortage: true,
      category_counts: { top: 3, bottom: 1, shoes: 0 },
      shortage_categories: ['bottom', 'shoes'],
      notice_cd: 'clothing_shortage',
    }),
  ),
  http.post('/api/recommendation-sessions', async ({ request }) => {
    const body = RecommendationSessionCreate.parse(await request.json());
    const sessionId = body.tpo_text?.includes(FAILURE_KEYWORD)
      ? nextFailedSessionId++
      : nextSessionId++;
    sessions.set(sessionId, {
      request: body,
      createdAt: Date.now(),
      sessionStatusCd: 'active',
    });

    return HttpResponse.json<RecommendationSessionCreated>(
      { recommendation_session_id: sessionId, session_status_cd: 'active' },
      { status: 202 },
    );
  }),
  http.get<SessionParams>(
    '/api/recommendation-sessions/:sessionId',
    ({ params }) => {
      const sessionId = Number(params.sessionId);
      const session = getSession(sessionId);

      return HttpResponse.json<RecommendationResult>(
        toResult(sessionId, session),
      );
    },
  ),
  http.post<SessionParams>(
    '/api/recommendation-sessions/:sessionId/rating',
    async ({ params, request }) => {
      const sessionId = Number(params.sessionId);
      const session = getSession(sessionId);
      const body = RatingCreate.parse(await request.json());

      if (hasKeyword(session, RESULT_KEYWORD.RATING_FAILURE)) {
        return HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '서버에 문제가 생겼어요.' },
          { status: 500 },
        );
      }

      if (
        session.sessionStatusCd === 'completed' ||
        hasKeyword(session, RESULT_KEYWORD.RATING_SETTLED)
      ) {
        return HttpResponse.json(
          {
            code: 'SESSION_ALREADY_SETTLED',
            message: '이미 별점을 매겨 끝난 추천입니다.',
          },
          { status: 409 },
        );
      }

      if (
        session.sessionStatusCd !== 'active' ||
        hasKeyword(session, RESULT_KEYWORD.RATING_EXPIRED)
      ) {
        return HttpResponse.json(
          {
            code: 'SESSION_NOT_RATABLE',
            message: '별점을 매길 수 없는 세션입니다.',
          },
          { status: 409 },
        );
      }

      session.sessionStatusCd = 'completed';
      session.rated = { outfitId: body.outfit_id, rating: body.rating };

      return HttpResponse.json<RatingResult>({
        recommendation_session_id: sessionId,
        outfit_id: body.outfit_id,
        rating: body.rating,
        session_status_cd: 'completed',
      });
    },
  ),
  http.post<SessionParams>(
    '/api/recommendation-sessions/:sessionId/regenerations',
    async ({ params, request }) => {
      const sessionId = Number(params.sessionId);
      const session = getSession(sessionId);
      const body = RegenerationCreate.parse(await request.json());
      const requestText = body.request_text.trim();

      if (session.sessionStatusCd === 'completed') {
        return HttpResponse.json(
          {
            code: 'SESSION_ALREADY_SETTLED',
            message: '이미 별점을 매겨 끝난 추천입니다.',
          },
          { status: 409 },
        );
      }

      if (
        session.sessionStatusCd !== 'active' ||
        requestText.includes(REGENERATION_KEYWORD.SESSION_ENDED)
      ) {
        return HttpResponse.json(
          {
            code: 'SESSION_ENDED',
            message: '이미 끝난 추천입니다. 새로 추천을 받아 주세요.',
          },
          { status: 409 },
        );
      }

      if (session.regeneration && !session.regeneration.isSettled) {
        return HttpResponse.json(
          {
            code: 'REGENERATION_IN_PROGRESS',
            message:
              '앞서 요청한 코디를 만들고 있습니다. 끝난 뒤에 다시 요청해 주세요.',
          },
          { status: 409 },
        );
      }

      if ([...requestText].length > REGENERATION_MAX_LENGTH) {
        return HttpResponse.json(
          {
            code: 'REGENERATION_REQUEST_TOO_LONG',
            message: `요청은 ${REGENERATION_MAX_LENGTH}자까지 입력할 수 있습니다. 조금 줄여서 다시 입력해 주세요.`,
          },
          { status: 422 },
        );
      }

      if (
        requestText === '' ||
        requestText.includes(REGENERATION_KEYWORD.UNCLEAR)
      ) {
        return HttpResponse.json(
          {
            code: 'REGENERATION_REQUEST_UNCLEAR',
            message: '요청을 이해하지 못했습니다. 다시 말씀해 주세요.',
          },
          { status: 422 },
        );
      }

      if (requestText.includes(REGENERATION_KEYWORD.UNAVAILABLE)) {
        return HttpResponse.json(
          {
            code: 'REGENERATION_INTENT_UNAVAILABLE',
            message: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          },
          { status: 503 },
        );
      }

      const requestSeq = (session.regeneration?.requestSeq ?? 0) + 1;

      session.regeneration = {
        requestSeq,
        targetScopeCd: body.target_scope_cd,
        targetOutfitId: body.target_outfit_id ?? null,
        startedAt: Date.now(),
        willFail: requestText.includes(REGENERATION_KEYWORD.FAILURE),
        isSettled: false,
      };

      return HttpResponse.json<RegenerationCreated>(
        {
          recommendation_session_id: sessionId,
          regeneration_request_id: requestSeq,
          request_seq: requestSeq,
          regeneration_status_cd: 'processing',
        },
        { status: 202 },
      );
    },
  ),
  http.get<SessionParams>(
    '/api/recommendation-history/:sessionId',
    ({ params }) => {
      const sessionId = Number(params.sessionId);
      const session = sessions.get(sessionId);

      if (session && session.sessionStatusCd !== 'completed') {
        return HttpResponse.json(
          {
            code: 'SESSION_NOT_FOUND',
            message: '추천 내역을 찾을 수 없습니다.',
          },
          { status: 404 },
        );
      }

      return HttpResponse.json<RecommendationHistoryDetail>(
        toHistoryDetail(sessionId, session),
      );
    },
  ),
  http.post<SessionParams>(
    '/api/recommendation-sessions/:sessionId/cancel',
    ({ params }) => {
      const sessionId = Number(params.sessionId);
      const session = getSession(sessionId);

      if (session.sessionStatusCd === 'active') {
        session.sessionStatusCd = 'canceled';
      }

      return HttpResponse.json<CancelResult>({
        recommendation_session_id: sessionId,
        session_status_cd:
          session.sessionStatusCd === 'abandoned' ? 'abandoned' : 'canceled',
      });
    },
  ),
];
