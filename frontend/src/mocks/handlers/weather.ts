import { http, HttpResponse } from 'msw';
import type { WeatherPreview } from '@/generated/models';

export const weatherHandlers = [
  http.get('/api/weather/preview', () =>
    HttpResponse.json<WeatherPreview>({
      temperature: 24.3,
      feels_like_temperature: 25.1,
      weather_condition_cd: 'overcast',
      is_fallback: false,
      is_sky_missing: false,
    }),
  ),
];
