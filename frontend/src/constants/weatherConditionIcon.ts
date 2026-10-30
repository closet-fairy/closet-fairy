import type { IconName } from '@/assets/icons';
import type { WeatherPreview } from '@/generated/models';

export const WEATHER_CONDITION_ICONS: Record<
  WeatherPreview['weather_condition_cd'],
  IconName
> = {
  clear: 'sunny',
  cloudy: 'partly_cloudy_day',
  overcast: 'cloud',
  rain: 'rainy',
  sleet: 'weather_mix',
  snow: 'weather_snowy',
};
