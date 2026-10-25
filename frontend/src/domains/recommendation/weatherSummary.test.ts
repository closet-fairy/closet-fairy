import { describe, expect, test } from 'vitest';
import type { WeatherPreview } from '@/generated/models';
import { formatTemperature, getWeatherSummary } from './weatherSummary';

const createPreview = (overrides: Partial<WeatherPreview> = {}) => ({
  temperature: 24.3,
  feels_like_temperature: 25.1,
  weather_condition_cd: 'overcast' as const,
  is_fallback: false,
  is_sky_missing: false,
  ...overrides,
});

describe('기온 표시', () => {
  test('기온은 반올림한 정수에 도 기호를 붙여야 한다.', () => {
    expect(formatTemperature(24.5)).toBe('25°');
    expect(formatTemperature(24.4)).toBe('24°');
    expect(formatTemperature(-3.6)).toBe('-4°');
  });

  test('0도 근처의 음수를 반올림해도 -0°가 아니라 0°로 보여야 한다.', () => {
    expect(formatTemperature(-0.4)).toBe('0°');
  });
});

describe('날씨 요약', () => {
  test('조회에 성공하면 기온과 날씨 상태 문구를 함께 돌려줘야 한다.', () => {
    expect(getWeatherSummary(createPreview())).toEqual({
      isAvailable: true,
      temperatureLabel: '24°',
      condition: { cd: 'overcast', label: '흐림' },
    });
  });

  test.each([
    ['clear', '맑음'],
    ['cloudy', '구름많음'],
    ['overcast', '흐림'],
    ['rain', '비'],
    ['sleet', '비/눈'],
    ['snow', '눈'],
  ] as const)(
    '날씨 상태 코드 %s는 "%s"로 보여야 한다.',
    (conditionCd, label) => {
      const summary = getWeatherSummary(
        createPreview({ weather_condition_cd: conditionCd }),
      );

      expect(summary).toMatchObject({ condition: { cd: conditionCd, label } });
    },
  );

  test('하늘상태 예보가 없으면 기온만 보여 주고 날씨 상태는 비워야 한다.', () => {
    const summary = getWeatherSummary(
      createPreview({ weather_condition_cd: 'clear', is_sky_missing: true }),
    );

    expect(summary).toEqual({
      isAvailable: true,
      temperatureLabel: '24°',
      condition: null,
    });
  });

  test('기상청 조회에 실패한 대체값이면 기온도 보여 주지 않아야 한다.', () => {
    const summary = getWeatherSummary(createPreview({ is_fallback: true }));

    expect(summary).toEqual({ isAvailable: false });
  });
});
