import { describe, expect, test } from 'vitest';
import { RecommendationSessionCreate } from '@/generated/models';
import { TPO_PRESETS } from './tpoPresets';

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
