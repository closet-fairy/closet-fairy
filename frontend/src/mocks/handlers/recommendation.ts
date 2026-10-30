import { http, HttpResponse } from 'msw';
import type {
  CancelResult,
  ClothingShortagePrecheckResponse,
  OutfitItemResult,
  OutfitResult,
  RecommendationResult,
  RecommendationSessionCreated,
  RecommendationSessionCreateOutput,
} from '@/generated/models';
import { RecommendationSessionCreate } from '@/generated/models';

interface SessionParams {
  sessionId: string;
}

interface MockSession {
  request: RecommendationSessionCreateOutput | null;
  createdAt: number;
  sessionStatusCd: RecommendationResult['session_status_cd'];
}

// 직접 입력에 이 말을 넣으면 생성이 실패하는 세션을 만든다. 새로고침해도 알 수 있게 번호로 구분한다.
const FAILURE_KEYWORD = '실패';
const FIRST_FAILED_SESSION_ID = 9001;
// 진행 화면과 취소를 dev:mock에서 직접 해 볼 수 있도록 생성에 몇 초가 걸리는 것처럼 둔다.
const GENERATION_MS = 6000;
const OUTFIT_COUNT = 4;
const SAMPLE_CUTOUT_URL = '/media/clothing/1/sample_cutout.webp';
// 직접 입력에 이 말을 넣으면 결과 화면의 해당 상태를 dev:mock에서 볼 수 있다.
const RESULT_KEYWORD = {
  SINGLE_OUTFIT: '한벌',
  ESSENTIAL_ONLY: '에센셜',
  CLOTHING_SHORTAGE: '옷부족',
  ESTIMATED_WEATHER: '추정',
  NO_REASON: '이유없음',
} as const;

const sessions = new Map<number, MockSession>();
let nextSessionId = 1;
let nextFailedSessionId = FIRST_FAILED_SESSION_ID;

export const resetRecommendationMocks = () => {
  sessions.clear();
  nextSessionId = 1;
  nextFailedSessionId = FIRST_FAILED_SESSION_ID;
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

const getWeather = (session: MockSession | undefined) => ({
  temperature: 14.2,
  feels_like_temperature: 12.8,
  weather_condition_cd: 'cloudy' as const,
  is_fallback: hasKeyword(session, RESULT_KEYWORD.ESTIMATED_WEATHER),
});

const toResult = (
  sessionId: number,
  session: MockSession,
): RecommendationResult => {
  const generationStatusCd = getGenerationStatusCd(sessionId, session);
  const isCompleted =
    generationStatusCd === 'completed' && session.sessionStatusCd === 'active';

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
    outfits: isCompleted ? createOutfits(sessionId, session) : [],
    latest_regeneration: null,
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
