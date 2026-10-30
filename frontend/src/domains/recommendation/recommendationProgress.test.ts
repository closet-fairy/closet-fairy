import { describe, expect, test } from 'vitest';
import {
  canViewRecommendationResult,
  getRecommendationProgress,
  keepViewedOutfits,
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

describe('보던 코디 유지', () => {
  const outfit = {
    outfit_id: 1,
    outfit_seq: 1,
    outfit_type_cd: 'preferred' as const,
    reason: null,
    items: [],
    previous_outfits: [],
  };
  const viewed = {
    generation_status_cd: 'completed' as const,
    session_status_cd: 'active' as const,
    outfits: [outfit],
  };

  test('보던 중 세션이 끝나 코디가 비어 오면 세션 상태는 새 값으로, 코디는 보던 값으로 두어야 한다.', () => {
    const next = {
      generation_status_cd: 'completed' as const,
      session_status_cd: 'abandoned' as const,
      outfits: [],
    };

    expect(keepViewedOutfits(viewed, next)).toEqual({
      ...next,
      outfits: [outfit],
    });
  });

  test('새 응답에 코디가 있으면 새 응답을 그대로 써야 한다.', () => {
    const next = { ...viewed, outfits: [{ ...outfit, outfit_id: 2 }] };

    expect(keepViewedOutfits(viewed, next)).toBe(next);
  });

  test('세션이 끝난 뒤 다시 조회해도 보던 코디가 남아 있어야 한다.', () => {
    const ended = { ...viewed, session_status_cd: 'abandoned' as const };

    expect(keepViewedOutfits(ended, { ...ended, outfits: [] }).outfits).toEqual(
      [outfit],
    );
  });

  test('받은 코디가 없었으면 빈 코디를 그대로 둬야 한다.', () => {
    const next = { ...viewed, outfits: [] };

    expect(keepViewedOutfits({ outfits: [] }, next).outfits).toEqual([]);
  });
});
