import type { RecommendationSessionCreate } from '@/generated/models';

interface TpoPreset {
  value: Exclude<RecommendationSessionCreate['tpo_cd'], 'custom'>;
  label: string;
}

/*
 * BE는 rainy(우천)와 midwinter(한겨울)도 받지만 칩으로는 보여 주지 않는다.
 * 두 코드는 예보와 상관없이 강수와 아우터 필수를 덮어쓰는데, 상황은 하나만 고를 수 있어
 * "비 오는 날 출근" 같은 조합을 만들 수 없다. 강수와 추위는 BE가 날씨 정보로 판단한다.
 */
export const TPO_PRESETS = [
  { value: 'daily', label: '데일리' },
  { value: 'work', label: '출근' },
  { value: 'date', label: '데이트' },
  { value: 'exercise', label: '운동' },
  { value: 'formal', label: '격식 있는 자리' },
] as const satisfies readonly TpoPreset[];

export type TpoPresetCd = (typeof TPO_PRESETS)[number]['value'];

export const getTpoLabel = (condition: {
  tpo_cd: RecommendationSessionCreate['tpo_cd'];
  tpo_text: string | null;
}) =>
  TPO_PRESETS.find((preset) => preset.value === condition.tpo_cd)?.label ??
  condition.tpo_text;
