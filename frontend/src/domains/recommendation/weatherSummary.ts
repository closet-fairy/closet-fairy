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
  const rounded = Math.round(temperature);

  return `${rounded}°`;
};

// 소수는 한 자리까지 보여 주고, 반올림해 0이 되면 표시하지 않는다.
export const getPrecipitationLabel = (precipitation: number) => {
  const rounded = Number(precipitation.toFixed(1));

  return rounded > 0 ? `강수 ${rounded}mm` : null;
};

export const getWeatherLabel = (
  weather: Pick<WeatherPreview, 'temperature' | 'weather_condition_cd'>,
) => {
  const { temperature, weather_condition_cd: conditionCd } = weather;

  return `${formatTemperature(temperature)} ${WEATHER_CONDITION_LABELS[conditionCd]}`;
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
