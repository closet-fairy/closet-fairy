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

// 세션이 끝나면 BE가 코디를 정리하므로, 진행 중인 세션에 코디가 있을 때만 결과를 볼 수 있다.
export const canViewRecommendationResult = (
  result: Pick<
    RecommendationResult,
    'generation_status_cd' | 'session_status_cd' | 'outfits'
  >,
) =>
  result.session_status_cd === 'active' &&
  result.generation_status_cd === 'completed' &&
  result.outfits.length > 0;

type ResultOutfits = Pick<RecommendationResult, 'outfits'>;

// 보던 중 세션이 끝나면 다음 응답부터 코디가 비어 오지만, 종료 안내 뒤에는 보던 코디가 남아야 한다.
export const keepViewedOutfits = <
  Previous extends ResultOutfits,
  Next extends ResultOutfits,
>(
  previous: Previous,
  next: Next,
) =>
  previous.outfits.length > 0 && next.outfits.length === 0
    ? { ...next, outfits: previous.outfits }
    : next;
