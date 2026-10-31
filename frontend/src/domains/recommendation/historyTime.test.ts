import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  formatHistoryDateTime,
  formatHistoryGoingOutRange,
} from './historyTime';

const NOW = new Date('2026-10-31T12:00:00+09:00');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('추천 내역 외출 구간 표기', () => {
  test('같은 날이면 끝은 시각만 써야 한다.', () => {
    expect(
      formatHistoryGoingOutRange(
        '2026-10-31T18:00:00+09:00',
        '2026-10-31T23:30:00+09:00',
        NOW,
      ),
    ).toBe('오늘 18:00 – 23:30');
  });

  test('자정을 넘기면 끝에 다음 날을 붙여야 한다.', () => {
    expect(
      formatHistoryGoingOutRange(
        '2026-10-31T18:00:00+09:00',
        '2026-11-01T00:30:00+09:00',
        NOW,
      ),
    ).toBe('오늘 18:00 – 다음 날 00:30');
  });

  test('오래된 기록도 끝은 시작을 기준으로 써야 한다.', () => {
    expect(
      formatHistoryGoingOutRange(
        '2026-08-23T18:00:00+09:00',
        '2026-08-24T00:30:00+09:00',
        NOW,
      ),
    ).toBe('2026. 8. 23 18:00 – 다음 날 00:30');
  });
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
