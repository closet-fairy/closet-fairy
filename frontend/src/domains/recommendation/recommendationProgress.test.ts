import { describe, expect, test } from 'vitest';
import { getRecommendationProgress } from './recommendationProgress';

describe('추천 진행 상태', () => {
  test.each([
    ['processing', 'active', 'processing'],
    ['completed', 'active', 'completed'],
    ['completed', 'completed', 'completed'],
    ['failed', 'active', 'failed'],
    ['failed', 'canceled', 'ended'],
    ['failed', 'abandoned', 'ended'],
    ['completed', 'canceled', 'ended'],
    ['processing', 'abandoned', 'ended'],
  ] as const)(
    '생성 %s, 세션 %s면 %s여야 한다.',
    (generationStatusCd, sessionStatusCd, progress) => {
      expect(
        getRecommendationProgress({
          generation_status_cd: generationStatusCd,
          session_status_cd: sessionStatusCd,
        }),
      ).toBe(progress);
    },
  );
});
