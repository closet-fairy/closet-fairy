import type { RecommendationResult } from '@/generated/models';

export type RecommendationProgress =
  'processing' | 'completed' | 'failed' | 'ended';

// 취소·이탈로 끝난 세션은 생성 중이었어도 BE가 failed로 주므로, 세션 상태를 먼저 본다.
export const getRecommendationProgress = (
  result: Pick<
    RecommendationResult,
    'generation_status_cd' | 'session_status_cd'
  >,
): RecommendationProgress => {
  if (
    result.session_status_cd === 'canceled' ||
    result.session_status_cd === 'abandoned'
  ) {
    return 'ended';
  }

  if (result.generation_status_cd === 'completed') {
    return 'completed';
  }

  if (result.generation_status_cd === 'failed') {
    return 'failed';
  }

  return 'processing';
};
