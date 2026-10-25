import type { MemberMe, MemberSettingsOutput } from '@/generated/models';

export type TemperatureSensitivityCd = NonNullable<
  MemberSettingsOutput['temperature_sensitivity_cd']
>;
export type GenderCd = MemberSettingsOutput['gender_cd'];
export type StyleCd = MemberSettingsOutput['style_cds'][number];
export type ProviderCd = MemberMe['provider_cd'];

interface SettingOption<T extends string> {
  value: T;
  label: string;
}

interface StyleOption extends SettingOption<StyleCd> {
  description: string;
}

export const TEMPERATURE_SENSITIVITY_OPTIONS: readonly SettingOption<TemperatureSensitivityCd>[] =
  [
    { value: 'cold_sensitive', label: '추위 많이 탐' },
    { value: 'normal', label: '보통' },
    { value: 'heat_sensitive', label: '더위 많이 탐' },
  ];

export const GENDER_OPTIONS: readonly SettingOption<GenderCd>[] = [
  { value: 'male', label: '남' },
  { value: 'female', label: '여' },
  { value: 'unisex', label: '유니섹스' },
];

export const STYLE_OPTIONS: readonly StyleOption[] = [
  { value: 'minimal', label: '미니멀', description: '단정하고 군더더기 없는' },
  { value: 'casual', label: '캐주얼', description: '편하게 매일 입는' },
  { value: 'street', label: '스트릿', description: '거리에서 눈에 띄는' },
  { value: 'classic', label: '클래식', description: '유행을 타지 않는' },
  { value: 'formal', label: '포멀', description: '격식을 갖춘 자리에' },
  { value: 'sporty', label: '스포티', description: '활동적이고 가벼운' },
  { value: 'romantic', label: '로맨틱', description: '부드럽고 사랑스러운' },
  { value: 'vintage', label: '빈티지', description: '오래된 멋이 있는' },
  {
    value: 'bohemian',
    label: '보헤미안',
    description: '자유롭고 자연스러운',
  },
  { value: 'preppy', label: '프레피', description: '단정한 학생룩' },
  { value: 'chic', label: '시크', description: '도시적이고 세련된' },
  { value: 'unique', label: '유니크', description: '개성이 뚜렷한' },
  { value: 'feminine', label: '페미닌', description: '여성스럽고 우아한' },
];

export const PROVIDER_LABEL: Record<ProviderCd, string> = {
  google: '구글',
  kakao: '카카오',
};

export const isTemperatureSensitivityCd = (
  value: string,
): value is TemperatureSensitivityCd =>
  TEMPERATURE_SENSITIVITY_OPTIONS.some((option) => option.value === value);

export const isGenderCd = (value: string): value is GenderCd =>
  GENDER_OPTIONS.some((option) => option.value === value);

export const isStyleCd = (value: string): value is StyleCd =>
  STYLE_OPTIONS.some((option) => option.value === value);

export const getTemperatureSensitivityLabel = (
  value: TemperatureSensitivityCd,
) =>
  TEMPERATURE_SENSITIVITY_OPTIONS.find((option) => option.value === value)
    ?.label ?? value;

export const getGenderLabel = (value: GenderCd) =>
  GENDER_OPTIONS.find((option) => option.value === value)?.label ?? value;

export const getStyleLabel = (value: StyleCd) =>
  STYLE_OPTIONS.find((option) => option.value === value)?.label ?? value;

export const sortStyleCds = (values: readonly StyleCd[]) =>
  STYLE_OPTIONS.map((option) => option.value).filter((value) =>
    values.includes(value),
  );
