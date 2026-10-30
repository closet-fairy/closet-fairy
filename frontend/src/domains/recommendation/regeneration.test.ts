import { describe, expect, test } from 'vitest';
import type { RecommendationResult } from '@/generated/models';
import {
  isOutfitRegenerating,
  isRegenerationFailureNoticed,
  isRegenerationProcessing,
} from './regeneration';

type LatestRegeneration = NonNullable<
  RecommendationResult['latest_regeneration']
>;

const createRegeneration = (
  overrides: Partial<LatestRegeneration> = {},
): LatestRegeneration => ({
  request_seq: 1,
  regeneration_status_cd: 'processing',
  target_scope_cd: 'single',
  target_outfit_id: 11,
  target_slot_cd: null,
  ...overrides,
});

describe('재추천 진행 판단', () => {
  test('만드는 중일 때만 진행 중으로 봐야 한다.', () => {
    expect(isRegenerationProcessing(createRegeneration())).toBe(true);
    expect(
      isRegenerationProcessing(
        createRegeneration({ regeneration_status_cd: 'failed' }),
      ),
    ).toBe(false);
    expect(isRegenerationProcessing(null)).toBe(false);
  });
});

describe('재추천 대상 카드 판단', () => {
  test('한 벌만 요청하면 그 코디만 대상이어야 한다.', () => {
    const regeneration = createRegeneration();

    expect(isOutfitRegenerating(regeneration, 11)).toBe(true);
    expect(isOutfitRegenerating(regeneration, 12)).toBe(false);
  });

  test('전체를 요청하면 모든 코디가 대상이어야 한다.', () => {
    const regeneration = createRegeneration({
      target_scope_cd: 'all',
      target_outfit_id: null,
    });

    expect(isOutfitRegenerating(regeneration, 11)).toBe(true);
    expect(isOutfitRegenerating(regeneration, 12)).toBe(true);
  });

  test('끝난 재추천은 대상이 없어야 한다.', () => {
    expect(
      isOutfitRegenerating(
        createRegeneration({ regeneration_status_cd: 'completed' }),
        11,
      ),
    ).toBe(false);
    expect(isOutfitRegenerating(null, 11)).toBe(false);
  });
});

describe('재추천 실패 안내 기록', () => {
  test('같은 세션의 같은 요청이면 안내한 것으로 봐야 한다.', () => {
    expect(
      isRegenerationFailureNoticed({ sessionId: 5, requestSeq: 2 }, 5, 2),
    ).toBe(true);
  });

  test('요청이나 세션이 다르면 안내하지 않은 것으로 봐야 한다.', () => {
    const notice = { sessionId: 5, requestSeq: 2 };

    expect(isRegenerationFailureNoticed(notice, 5, 3)).toBe(false);
    expect(isRegenerationFailureNoticed(notice, 6, 2)).toBe(false);
  });

  test('기록이 없거나 형식이 틀리면 안내하지 않은 것으로 봐야 한다.', () => {
    expect(isRegenerationFailureNoticed(null, 5, 2)).toBe(false);
    expect(isRegenerationFailureNoticed({ requestSeq: '2' }, 5, 2)).toBe(false);
  });
});
