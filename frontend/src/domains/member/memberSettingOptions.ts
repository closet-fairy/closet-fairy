import type { MemberMe, MemberSettingsOutput } from '@/generated/models';
import { MemberSettings } from '@/generated/models';

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

const TEMPERATURE_SENSITIVITY_CDS =
  MemberSettings.shape.temperature_sensitivity_cd.options[0].options;
const GENDER_CDS = MemberSettings.shape.gender_cd.options;
const STYLE_CDS = MemberSettings.shape.style_cds.element.options;

const TEMPERATURE_SENSITIVITY_LABEL: Record<TemperatureSensitivityCd, string> =
  {
    cold_sensitive: '추위 많이 탐',
    normal: '보통',
    heat_sensitive: '더위 많이 탐',
  };

const GENDER_LABEL: Record<GenderCd, string> = {
  male: '남',
  female: '여',
  unisex: '유니섹스',
};

const STYLE_TEXT: Record<StyleCd, Omit<StyleOption, 'value'>> = {
  minimal: { label: '미니멀', description: '단정하고 군더더기 없는' },
  casual: { label: '캐주얼', description: '편하게 매일 입는' },
  street: { label: '스트릿', description: '거리에서 눈에 띄는' },
  classic: { label: '클래식', description: '유행을 타지 않는' },
  formal: { label: '포멀', description: '격식을 갖춘 자리에' },
  sporty: { label: '스포티', description: '활동적이고 가벼운' },
  romantic: { label: '로맨틱', description: '부드럽고 사랑스러운' },
  vintage: { label: '빈티지', description: '오래된 멋이 있는' },
  bohemian: { label: '보헤미안', description: '자유롭고 자연스러운' },
  preppy: { label: '프레피', description: '단정한 학생룩' },
  chic: { label: '시크', description: '도시적이고 세련된' },
  unique: { label: '유니크', description: '개성이 뚜렷한' },
  feminine: { label: '페미닌', description: '여성스럽고 우아한' },
};

export const TEMPERATURE_SENSITIVITY_OPTIONS: readonly SettingOption<TemperatureSensitivityCd>[] =
  TEMPERATURE_SENSITIVITY_CDS.map((value) => ({
    value,
    label: TEMPERATURE_SENSITIVITY_LABEL[value],
  }));

export const GENDER_OPTIONS: readonly SettingOption<GenderCd>[] =
  GENDER_CDS.map((value) => ({ value, label: GENDER_LABEL[value] }));

export const STYLE_OPTIONS: readonly StyleOption[] = STYLE_CDS.map((value) => ({
  value,
  ...STYLE_TEXT[value],
}));

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
) => TEMPERATURE_SENSITIVITY_LABEL[value];

export const getGenderLabel = (value: GenderCd) => GENDER_LABEL[value];

export const getStyleLabel = (value: StyleCd) => STYLE_TEXT[value].label;

export const sortStyleCds = (values: readonly StyleCd[]) =>
  STYLE_OPTIONS.map((option) => option.value).filter((value) =>
    values.includes(value),
  );
