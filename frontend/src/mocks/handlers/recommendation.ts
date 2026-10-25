import { http, HttpResponse } from 'msw';
import type {
  CancelResult,
  ClothingShortagePrecheckResponse,
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

// 직접 입력에 이 말을 넣으면 생성이 실패하는 세션을 만든다.
const FAILURE_KEYWORD = '실패';
const FAILED_SESSION_ID = 9001;
// 진행 화면과 취소를 dev:mock에서 직접 해 볼 수 있도록 생성에 몇 초가 걸리는 것처럼 둔다.
const GENERATION_MS = 6000;

const sessions = new Map<number, MockSession>();
let nextSessionId = 1;

export const resetRecommendationMocks = () => {
  sessions.clear();
  nextSessionId = 1;
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

  return sessionId === FAILED_SESSION_ID ? 'failed' : 'completed';
};

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
    is_clothing_shortage: true,
    condition: {
      tpo_cd: session.request?.tpo_cd ?? 'daily',
      tpo_text: session.request?.tpo_text ?? null,
      season_cd: 'fall',
      going_out_start_at: '2026-10-26T09:00:00+09:00',
      going_out_end_at: '2026-10-26T14:00:00+09:00',
    },
    weather: isCompleted
      ? {
          temperature: 14.2,
          feels_like_temperature: 12.8,
          weather_condition_cd: 'cloudy',
          is_fallback: false,
        }
      : null,
    outfits: isCompleted
      ? [
          {
            outfit_id: sessionId * 10 + 1,
            outfit_seq: 1,
            outfit_type_cd: 'preferred',
            reason: '아침이 쌀쌀해 가벼운 아우터를 걸쳤어요.',
            items: [
              {
                slot_cd: 'top',
                accessory_type_cd: null,
                item_source_cd: 'owned',
                item_name: '화이트 옥스퍼드 셔츠',
                image_url: null,
                style_cds: ['classic'],
              },
              {
                slot_cd: 'bottom',
                accessory_type_cd: null,
                item_source_cd: 'essential',
                item_name: '블랙 슬랙스',
                image_url: null,
                style_cds: ['minimal'],
              },
            ],
          },
        ]
      : [],
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
      ? FAILED_SESSION_ID
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
