import { describe, expect, test } from 'vitest';
import { RecommendationSessionCreate } from '@/generated/models';
import { TPO_PRESETS } from './tpoPresets';

const tpoCdSchema = RecommendationSessionCreate.shape.tpo_cd;

describe('상황 프리셋 목록', () => {
  test('모든 프리셋 코드는 BE 스펙의 tpo_cd 값이어야 한다.', () => {
    TPO_PRESETS.forEach((preset) => {
      expect(tpoCdSchema.safeParse(preset.value).success).toBe(true);
    });
  });

  test('날씨가 대신 판단하는 rainy와 midwinter는 프리셋에 들어가지 않아야 한다.', () => {
    const presetValues = TPO_PRESETS.map((preset) => preset.value);

    expect(presetValues).not.toContain('rainy');
    expect(presetValues).not.toContain('midwinter');
  });

  test('직접 입력인 custom은 프리셋에 들어가지 않아야 한다.', () => {
    expect(TPO_PRESETS.map((preset) => preset.value)).not.toContain('custom');
  });
});
