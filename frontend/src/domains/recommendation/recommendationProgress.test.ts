import { describe, expect, test } from 'vitest';
import {
  canViewRecommendationResult,
  getRecommendationProgress,
} from './recommendationProgress';

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

describe('추천 결과를 볼 수 있는지 판단', () => {
  const outfit = {
    outfit_id: 1,
    outfit_seq: 1,
    outfit_type_cd: 'preferred' as const,
    reason: null,
    items: [],
    previous_outfits: [],
  };

  test('진행 중인 세션에 코디가 있으면 볼 수 있어야 한다.', () => {
    expect(
      canViewRecommendationResult({
        generation_status_cd: 'completed',
        session_status_cd: 'active',
        outfits: [outfit],
      }),
    ).toBe(true);
  });

  test.each([
    ['processing', 'active', []],
    ['failed', 'active', []],
    ['completed', 'active', []],
    ['completed', 'completed', [outfit]],
    ['completed', 'canceled', []],
    ['completed', 'abandoned', []],
  ] as const)(
    '생성 %s, 세션 %s이고 코디가 %j면 볼 수 없어야 한다.',
    (generationStatusCd, sessionStatusCd, outfits) => {
      expect(
        canViewRecommendationResult({
          generation_status_cd: generationStatusCd,
          session_status_cd: sessionStatusCd,
          outfits: [...outfits],
        }),
      ).toBe(false);
    },
  );
});
