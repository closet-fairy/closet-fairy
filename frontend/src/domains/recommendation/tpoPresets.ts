import type { RecommendationSessionCreate } from '@/generated/models';

export type TpoPresetCd = Exclude<
  RecommendationSessionCreate['tpo_cd'],
  'custom'
>;

interface TpoPreset {
  value: TpoPresetCd;
  label: string;
}

export const TPO_PRESETS: readonly TpoPreset[] = [
  { value: 'daily', label: '데일리' },
  { value: 'work', label: '출근' },
  { value: 'formal', label: '격식(결혼식·면접)' },
  { value: 'exercise', label: '운동' },
  { value: 'rainy', label: '우천' },
  { value: 'midwinter', label: '한겨울' },
  { value: 'date', label: '데이트' },
];
