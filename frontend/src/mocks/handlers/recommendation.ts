import { http, HttpResponse } from 'msw';
import type {
  ClothingShortagePrecheckResponse,
  RecommendationSessionCreated,
} from '@/generated/models';

export const recommendationHandlers = [
  http.get('/api/recommendations/precheck', () =>
    HttpResponse.json<ClothingShortagePrecheckResponse>({
      is_clothing_shortage: true,
      category_counts: { top: 3, bottom: 1, shoes: 0 },
      shortage_categories: ['bottom', 'shoes'],
      notice_cd: 'clothing_shortage',
    }),
  ),
  http.post('/api/recommendation-sessions', () =>
    HttpResponse.json<RecommendationSessionCreated>(
      { recommendation_session_id: 1, session_status_cd: 'active' },
      { status: 202 },
    ),
  ),
];
