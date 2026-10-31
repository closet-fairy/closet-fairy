import { afterEach, describe, expect, test, vi } from 'vitest';
import { formatHistoryDateTime } from './historyTime';

const NOW = new Date('2026-10-31T12:00:00+09:00');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('추천 내역 시각 표기', () => {
  test.each([
    ['2026-10-30T22:40:00+09:00', '어제 22:40'],
    ['2026-10-31T10:12:00+09:00', '오늘 10:12'],
    ['2026-11-01T18:00:00+09:00', '내일 18:00'],
  ])('어제, 오늘, 내일은 말로 써야 한다. (%s)', (dateTime, expected) => {
    expect(formatHistoryDateTime(dateTime, NOW)).toBe(expected);
  });

  test('그 밖의 날은 연도와 0을 붙이지 않은 월일로 써야 한다.', () => {
    expect(formatHistoryDateTime('2026-08-02T09:12:00+09:00', NOW)).toBe(
      '2026. 8. 2 09:12',
    );
  });

  test('모레도 날짜로 써야 한다.', () => {
    expect(formatHistoryDateTime('2026-11-02T08:30:00+09:00', NOW)).toBe(
      '2026. 11. 2 08:30',
    );
  });

  test('자정은 24시가 아니라 00시로 써야 한다.', () => {
    expect(formatHistoryDateTime('2026-10-31T00:05:00+09:00', NOW)).toBe(
      '오늘 00:05',
    );
  });

  test('기기 시간대가 아니라 한국 시간으로 날짜를 나눠야 한다.', async () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.resetModules();

    const { formatHistoryDateTime: formatInNewYork } =
      await import('./historyTime');

    expect(formatInNewYork('2026-10-30T15:30:00Z', NOW)).toBe('오늘 00:30');
  });
});
