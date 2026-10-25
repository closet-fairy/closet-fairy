import { describe, expect, test } from 'vitest';
import { RecommendationSessionCreate } from '@/generated/models';
import { toRecommendationSessionCreate } from './toRecommendationSessionCreate';

const form = {
  sidoNm: '서울특별시',
  sigunguNm: '성동구',
  tpo: { cd: 'work' },
  startTime: '09:00',
  endTime: '14:00',
} as const;

describe('추천 요청 본문 만들기', () => {
  test('위치는 시·도와 시·군·구를 각 필드에 담고, 직접 고른 위치로 보내야 한다.', () => {
    const body = toRecommendationSessionCreate(form);

    expect(body.sido_nm).toBe('서울특별시');
    expect(body.sigungu_nm).toBe('성동구');
    expect(body.location_input_type_cd).toBe('manual');
  });

  test('프리셋 상황이면 tpo_text 없이 tpo_cd만 담아야 한다.', () => {
    const body = toRecommendationSessionCreate(form);

    expect(body.tpo_cd).toBe('work');
    expect(body).not.toHaveProperty('tpo_text');
  });

  test('외출 시간은 HH:MM 문자열 그대로 담아야 한다.', () => {
    const body = toRecommendationSessionCreate(form);

    expect(body.going_out_start_time).toBe('09:00');
    expect(body.going_out_end_time).toBe('14:00');
  });

  test('직접 입력한 상황이면 tpo_cd를 custom으로 두고 앞뒤 공백을 지운 문구를 tpo_text에 담아야 한다.', () => {
    const body = toRecommendationSessionCreate({
      ...form,
      tpo: { cd: 'custom', text: '  학교 발표 ' },
    });

    expect(body.tpo_cd).toBe('custom');
    expect(body.tpo_text).toBe('학교 발표');
  });

  test('만든 본문은 생성된 요청 스키마의 필드 구성과 형식을 통과해야 한다.', () => {
    expect(
      RecommendationSessionCreate.safeParse(toRecommendationSessionCreate(form))
        .success,
    ).toBe(true);
  });
});
