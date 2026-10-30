import { describe, expect, test } from 'vitest';
import { RecommendationSessionCreate } from '@/generated/models';
import { getTpoLabel, TPO_PRESETS } from './tpoPresets';

const tpoCdSchema = RecommendationSessionCreate.shape.tpo_cd;

const HIDDEN_TPO_CDS: readonly string[] = ['custom', 'rainy', 'midwinter'];

describe('상황 프리셋 목록', () => {
  test('모든 프리셋 코드는 BE 스펙의 tpo_cd 값이어야 한다.', () => {
    TPO_PRESETS.forEach((preset) => {
      expect(tpoCdSchema.safeParse(preset.value).success).toBe(true);
    });
  });

  test('칩에서 숨긴 코드를 뺀 BE 스펙의 tpo_cd가 모두 프리셋에 있어야 한다.', () => {
    const presetValues = TPO_PRESETS.map((preset) => preset.value);
    const expectedValues = tpoCdSchema.options.filter(
      (value) => !HIDDEN_TPO_CDS.includes(value),
    );

    expect([...presetValues].sort()).toEqual([...expectedValues].sort());
  });
});

describe('상황 문구', () => {
  test('프리셋 코드는 칩과 같은 문구로 보여야 한다.', () => {
    expect(getTpoLabel({ tpo_cd: 'daily', tpo_text: null })).toBe('데일리');
  });

  test('직접 입력한 상황은 입력한 문구로 보여야 한다.', () => {
    expect(getTpoLabel({ tpo_cd: 'custom', tpo_text: '친구 결혼식' })).toBe(
      '친구 결혼식',
    );
  });

  test('문구가 없는 코드는 null을 돌려줘야 한다.', () => {
    expect(getTpoLabel({ tpo_cd: 'rainy', tpo_text: null })).toBeNull();
  });
});
