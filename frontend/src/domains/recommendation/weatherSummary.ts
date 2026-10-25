import type { WeatherPreview } from '@/generated/models';

type WeatherConditionCd = WeatherPreview['weather_condition_cd'];

const WEATHER_CONDITION_LABELS: Record<WeatherConditionCd, string> = {
  clear: '맑음',
  cloudy: '구름많음',
  overcast: '흐림',
  rain: '비',
  sleet: '비/눈',
  snow: '눈',
};

interface WeatherCondition {
  cd: WeatherConditionCd;
  label: string;
}

export type WeatherSummary =
  | { isAvailable: false }
  | {
      isAvailable: true;
      temperatureLabel: string;
      condition: WeatherCondition | null;
    };

export const formatTemperature = (temperature: number) => {
  // Math.round(-0.4)는 -0이라 그대로 두면 "-0°"로 보이므로 0으로 바꾼다.
  const rounded = Math.round(temperature) || 0;

  return `${rounded}°`;
};

export const getWeatherSummary = (preview: WeatherPreview): WeatherSummary => {
  const {
    temperature,
    weather_condition_cd: conditionCd,
    is_fallback: isFallback,
    is_sky_missing: isSkyMissing,
  } = preview;

  if (isFallback) {
    return { isAvailable: false };
  }

  return {
    isAvailable: true,
    temperatureLabel: formatTemperature(temperature),
    condition: isSkyMissing
      ? null
      : { cd: conditionCd, label: WEATHER_CONDITION_LABELS[conditionCd] },
  };
};
