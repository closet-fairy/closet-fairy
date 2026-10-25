import { describe, expect, test } from 'vitest';
import type { RecommendationFormDraft } from './recommendationRequestRecord';
import {
  parsePendingRecommendation,
  parseRecommendationFormDraft,
  restoreRecommendationForm,
} from './recommendationRequestRecord';

const draft: RecommendationFormDraft = {
  location: {
    sidoNm: '서울특별시',
    sigunguNm: '성동구',
    inputTypeCd: 'manual',
  },
  tpo: { cd: 'custom', text: '친구 결혼식' },
  customTpoText: '친구 결혼식',
  start: { date: '2026-10-14', time: '09:30' },
  end: '14:30',
};

const pending = {
  sessionId: 7,
  requestedAt: 1_000,
  request: {
    sido_nm: '서울특별시',
    sigungu_nm: '성동구',
    location_input_type_cd: 'manual',
    tpo_cd: 'custom',
    tpo_text: '친구 결혼식',
    going_out_start_time: '09:30',
    going_out_end_time: '14:30',
    going_out_date_cd: 'today',
  },
  form: draft,
};

describe('진행 중인 추천 요청 기록', () => {
  test('같은 세션의 기록이면 그대로 돌려줘야 한다.', () => {
    expect(parsePendingRecommendation(pending, 7)).toEqual(pending);
  });

  test('다른 세션의 기록이면 null이어야 한다.', () => {
    expect(parsePendingRecommendation(pending, 8)).toBeNull();
  });

  test('형식이 맞지 않으면 null이어야 한다.', () => {
    expect(parsePendingRecommendation({ sessionId: 7 }, 7)).toBeNull();
    expect(parsePendingRecommendation(null, 7)).toBeNull();
  });
});

describe('입력값 초안', () => {
  test('형식이 맞으면 그대로 돌려줘야 한다.', () => {
    expect(parseRecommendationFormDraft(draft)).toEqual(draft);
    expect(
      parseRecommendationFormDraft({ ...draft, tpo: { cd: 'work' } }),
    ).toEqual({ ...draft, tpo: { cd: 'work' } });
  });

  test('칩으로 보여 주지 않는 상황 코드면 null이어야 한다.', () => {
    expect(
      parseRecommendationFormDraft({ ...draft, tpo: { cd: 'rainy' } }),
    ).toBeNull();
  });

  test('나가는 시간이 아직 고를 수 있는 시각이면 시간까지 그대로 복원해야 한다.', () => {
    const now = new Date('2026-10-14T09:40:00+09:00');

    expect(restoreRecommendationForm(draft, now)).toEqual(draft);
    expect(
      restoreRecommendationForm(
        { ...draft, start: { date: '2026-10-15', time: '08:00' } },
        now,
      ).start,
    ).toEqual({ date: '2026-10-15', time: '08:00' });
  });

  test('직접 고르지 않은 시간은 비워 둔 채로 복원해야 한다.', () => {
    const untouched = { ...draft, start: null, end: null };

    expect(parseRecommendationFormDraft(untouched)).toEqual(untouched);
    expect(
      restoreRecommendationForm(
        untouched,
        new Date('2026-10-14T10:10:00+09:00'),
      ),
    ).toEqual(untouched);
  });

  test('나가는 시간이 지났으면 시간만 비우고 나머지는 남겨야 한다.', () => {
    const now = new Date('2026-10-14T10:10:00+09:00');

    expect(restoreRecommendationForm(draft, now)).toEqual({
      ...draft,
      start: null,
      end: null,
    });
  });
});
