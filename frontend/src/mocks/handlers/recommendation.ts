import { http, HttpResponse } from 'msw';
import type { RecommendationSessionCreated } from '@/generated/models';

export const recommendationHandlers = [
  http.post('/api/recommendation-sessions', () =>
    HttpResponse.json<RecommendationSessionCreated>(
      { recommendation_session_id: 1, session_status_cd: 'active' },
      { status: 202 },
    ),
  ),
];
