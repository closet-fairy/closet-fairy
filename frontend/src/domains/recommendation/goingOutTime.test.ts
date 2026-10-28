import { describe, expect, test } from 'vitest';
import {
  clampTimeSlot,
  createEndDayOptions,
  createEndTimeSlots,
  createStartDayOptions,
  createStartOptions,
  createStartTimeSlots,
  createTimeSlots,
  fitGoingOutDateTime,
  getCurrentTimeSlot,
  getDayOffset,
  getDefaultEndTime,
  getGoingOutDateCd,
  getKstDate,
  getMillisecondsUntilNextTimeSlot,
  isNextDayReturn,
  isPastTimeSlot,
  shiftKstDate,
  validateGoingOutTime,
} from './goingOutTime';

const at = (time: string) => new Date(`2026-10-14T${time}:00+09:00`);
const today = (time: string) => ({ date: '2026-10-14', time });
const tomorrow = (time: string) => ({ date: '2026-10-15', time });

describe('30분 단위 시간 슬롯', () => {
  test('00:00부터 23:30까지 30분 간격으로 48개를 만들어야 한다.', () => {
    const slots = createTimeSlots();

    expect(slots).toHaveLength(48);
    expect(slots.at(0)).toBe('00:00');
    expect(slots.at(1)).toBe('00:30');
    expect(slots.at(-1)).toBe('23:30');
  });
});

describe('현재 시각이 속한 슬롯', () => {
  test('정각과 30분 사이의 시각은 그 정각 슬롯이어야 한다.', () => {
    expect(getCurrentTimeSlot(at('14:10'))).toBe('14:00');
  });

  test('30분 정각은 30분 슬롯이어야 한다.', () => {
    expect(getCurrentTimeSlot(at('14:30'))).toBe('14:30');
  });

  test('자정 직전은 23:30 슬롯이어야 한다.', () => {
    expect(getCurrentTimeSlot(at('23:59'))).toBe('23:30');
  });
});

describe('지난 슬롯 판정', () => {
  test('현재 슬롯보다 이른 슬롯은 지난 슬롯이어야 한다.', () => {
    expect(isPastTimeSlot('13:30', at('14:10'))).toBe(true);
  });

  test('현재 슬롯은 지난 슬롯이 아니어야 한다.', () => {
    expect(isPastTimeSlot('14:00', at('14:10'))).toBe(false);
  });
});

describe('나가는 시간 선택지', () => {
  test('현재 슬롯부터 23:30까지만 고를 수 있어야 한다.', () => {
    const slots = createStartTimeSlots(at('14:10'));

    expect(slots.at(0)).toBe('14:00');
    expect(slots.at(-1)).toBe('23:30');
    expect(slots).toHaveLength(20);
  });
});

describe('돌아오는 시간 선택지', () => {
  test('나가는 시간 다음 슬롯부터 하루를 한 바퀴 도는 순서여야 한다.', () => {
    const slots = createEndTimeSlots('09:00');

    expect(slots.at(0)).toBe('09:30');
    expect(slots.at(-1)).toBe('08:30');
    expect(slots).toHaveLength(47);
  });

  test('나가는 시간과 같은 슬롯은 들어가지 않아야 한다.', () => {
    expect(createEndTimeSlots('09:00')).not.toContain('09:00');
  });
});

describe('다음 슬롯까지 남은 시간', () => {
  test('14:10이면 14:30까지 20분이 남아야 한다.', () => {
    expect(getMillisecondsUntilNextTimeSlot(at('14:10'))).toBe(20 * 60 * 1000);
  });

  test('슬롯 경계 정각이면 다음 경계까지 30분이 남아야 한다.', () => {
    expect(getMillisecondsUntilNextTimeSlot(at('14:30'))).toBe(30 * 60 * 1000);
  });
});

describe('돌아오는 시간 기본값', () => {
  test('나가는 시간의 5시간 뒤여야 한다.', () => {
    expect(getDefaultEndTime('09:00')).toBe('14:00');
  });

  test('5시간 뒤가 자정을 넘으면 다음 날 시각으로 넘어가야 한다.', () => {
    expect(getDefaultEndTime('21:30')).toBe('02:30');
  });
});

describe('다음 날 귀가 판정', () => {
  test('돌아오는 시간이 나가는 시간보다 이르면 다음 날 귀가여야 한다.', () => {
    expect(isNextDayReturn('21:30', '02:30')).toBe(true);
  });

  test('돌아오는 시간이 나가는 시간보다 늦으면 같은 날 귀가여야 한다.', () => {
    expect(isNextDayReturn('09:00', '14:00')).toBe(false);
  });

  test('돌아오는 시간이 나가는 시간과 같으면 다음 날 귀가가 아니어야 한다.', () => {
    expect(isNextDayReturn('09:00', '09:00')).toBe(false);
  });
});

describe('외출 시간 검증', () => {
  test('나가는 시간과 돌아오는 시간이 같으면 실패해야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: today('15:00'),
        end: '15:00',
        now: at('14:10'),
      }),
    ).toBe('외출 시작과 종료 시각이 같습니다.');
  });

  test('나가는 시간이 현재 슬롯보다 이르면 실패해야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: today('13:30'),
        end: '18:00',
        now: at('14:10'),
      }),
    ).toBe('외출 시작 시각이 이미 지났습니다.');
  });

  test('나가는 시간이 지났고 돌아오는 시간과도 같으면, BE처럼 같은 시각 문제를 먼저 알려야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: today('13:00'),
        end: '13:00',
        now: at('14:10'),
      }),
    ).toBe('외출 시작과 종료 시각이 같습니다.');
  });

  test('나가는 시간이 현재 슬롯과 같으면 통과해야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: today('14:00'),
        end: '18:00',
        now: at('14:10'),
      }),
    ).toBeNull();
  });

  test('돌아오는 시간이 나가는 시간보다 이르면 다음 날 귀가로 보고 통과해야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: today('22:00'),
        end: '01:00',
        now: at('14:10'),
      }),
    ).toBeNull();
  });

  test('내일 외출이면 현재 슬롯보다 이른 시각이어도 통과해야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: tomorrow('09:00'),
        end: '14:00',
        now: at('14:10'),
      }),
    ).toBeNull();
  });

  test('외출 날짜가 오늘보다 이르면 지난 시각으로 실패해야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: { date: '2026-10-13', time: '23:30' },
        end: '02:00',
        now: at('14:10'),
      }),
    ).toBe('외출 시작 시각이 이미 지났습니다.');
  });

  test('외출 날짜가 모레 이후면 실패해야 한다.', () => {
    expect(
      validateGoingOutTime({
        start: { date: '2026-10-16', time: '09:00' },
        end: '14:00',
        now: at('14:10'),
      }),
    ).toBe('외출 날짜는 오늘이나 내일만 고를 수 있습니다.');
  });
});

describe('KST 날짜', () => {
  test('KST 기준 날짜를 YYYY-MM-DD로 돌려줘야 한다.', () => {
    expect(getKstDate(new Date('2026-10-14T23:59:00+09:00'))).toBe(
      '2026-10-14',
    );
    expect(getKstDate(new Date('2026-10-14T15:00:00Z'))).toBe('2026-10-15');
  });

  test('날짜를 앞뒤로 옮길 때 달과 해가 바뀌는 경계를 넘어야 한다.', () => {
    expect(shiftKstDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftKstDate('2027-01-01', -1)).toBe('2026-12-31');
  });

  test('오늘과의 날짜 차이를 세야 한다.', () => {
    expect(getDayOffset('2026-10-14', at('23:59'))).toBe(0);
    expect(getDayOffset('2026-10-15', at('00:00'))).toBe(1);
    expect(getDayOffset('2026-10-13', at('12:00'))).toBe(-1);
  });

  test('오늘은 today, 내일은 tomorrow, 그 밖의 날짜는 null이어야 한다.', () => {
    expect(getGoingOutDateCd('2026-10-14', at('14:10'))).toBe('today');
    expect(getGoingOutDateCd('2026-10-15', at('14:10'))).toBe('tomorrow');
    expect(getGoingOutDateCd('2026-10-13', at('14:10'))).toBeNull();
    expect(getGoingOutDateCd('2026-10-16', at('14:10'))).toBeNull();
  });
});

describe('나가는 시각 선택지', () => {
  test('오늘 남은 슬롯 뒤에 내일의 모든 슬롯을 이어 붙여야 한다.', () => {
    const options = createStartOptions(at('22:10'));

    expect(options.slice(0, 4)).toEqual([
      today('22:00'),
      today('22:30'),
      today('23:00'),
      today('23:30'),
    ]);
    expect(options.slice(4)).toHaveLength(48);
    expect(options.at(4)).toEqual(tomorrow('00:00'));
    expect(options.at(-1)).toEqual(tomorrow('23:30'));
  });
});

describe('나가는 날짜별 시각', () => {
  test('오늘은 현재 슬롯부터, 내일은 모든 슬롯을 고를 수 있어야 한다.', () => {
    const [todayOption, tomorrowOption] = createStartDayOptions(at('22:10'));

    expect(todayOption).toEqual({
      date: '2026-10-14',
      times: ['22:00', '22:30', '23:00', '23:30'],
    });
    expect(tomorrowOption?.date).toBe('2026-10-15');
    expect(tomorrowOption?.times).toHaveLength(48);
  });

  test('자정 직전에도 오늘에는 현재 슬롯 하나가 남아야 한다.', () => {
    const [todayOption] = createStartDayOptions(at('23:45'));

    expect(todayOption?.times).toEqual(['23:30']);
  });
});

describe('돌아오는 날짜별 시각', () => {
  test('나가는 날은 나간 뒤 시각만, 다음 날은 나간 시각보다 이른 시각만 고를 수 있어야 한다.', () => {
    const [sameDay, nextDay] = createEndDayOptions(today('21:00'));

    expect(sameDay).toEqual({
      date: '2026-10-14',
      times: ['21:30', '22:00', '22:30', '23:00', '23:30'],
    });
    expect(nextDay?.date).toBe('2026-10-15');
    expect(nextDay?.times.at(0)).toBe('00:00');
    expect(nextDay?.times.at(-1)).toBe('20:30');
  });

  test('내일 나가면 내일과 모레를 고를 수 있어야 한다.', () => {
    const dates = createEndDayOptions(tomorrow('08:30')).map((day) => day.date);

    expect(dates).toEqual(['2026-10-15', '2026-10-16']);
  });

  test('23:30에 나가면 나가는 날에는 고를 시각이 없어 다음 날만 남아야 한다.', () => {
    const days = createEndDayOptions(today('23:30'));

    expect(days).toHaveLength(1);
    expect(days.at(0)?.date).toBe('2026-10-15');
    expect(days.at(0)?.times.at(-1)).toBe('23:00');
  });

  test('00:00에 나가면 다음 날에는 고를 시각이 없어 나가는 날만 남아야 한다.', () => {
    const days = createEndDayOptions(today('00:00'));

    expect(days).toHaveLength(1);
    expect(days.at(0)?.times.at(0)).toBe('00:30');
    expect(days.at(0)?.times.at(-1)).toBe('23:30');
  });
});

describe('범위 밖 시각 맞추기', () => {
  const slots = ['21:00', '21:30', '22:00'];

  test('범위 안의 시각은 그대로 두어야 한다.', () => {
    expect(clampTimeSlot('21:30', slots)).toBe('21:30');
  });

  test('범위보다 이른 시각은 첫 시각으로 맞춰야 한다.', () => {
    expect(clampTimeSlot('08:30', slots)).toBe('21:00');
  });

  test('범위보다 늦은 시각은 마지막 시각으로 맞춰야 한다.', () => {
    expect(clampTimeSlot('23:30', slots)).toBe('22:00');
  });
});

describe('고를 수 있는 날짜와 시각으로 맞추기', () => {
  test('내일 08:30에서 날짜만 오늘로 바꾸면 오늘의 첫 시각으로 맞춰야 한다.', () => {
    const days = createStartDayOptions(at('21:10'));

    expect(fitGoingOutDateTime(days, today('08:30'))).toEqual(today('21:00'));
  });

  test('돌아오는 시간을 다음 날로 바꿨을 때 시각이 늦으면 다음 날의 마지막 시각으로 맞춰야 한다.', () => {
    const days = createEndDayOptions(today('21:00'));

    expect(fitGoingOutDateTime(days, tomorrow('23:00'))).toEqual(
      tomorrow('20:30'),
    );
  });

  test('돌아오는 시각이 나가는 시각과 같으면 나간 뒤 첫 시각으로 맞춰야 한다.', () => {
    const days = createEndDayOptions(today('21:00'));

    expect(fitGoingOutDateTime(days, today('21:00'))).toEqual(today('21:30'));
  });

  test('고를 수 있는 날짜보다 이른 날짜는 첫 날짜로, 늦은 날짜는 마지막 날짜로 맞춰야 한다.', () => {
    const days = createStartDayOptions(at('09:10'));

    expect(
      fitGoingOutDateTime(days, { date: '2026-10-13', time: '23:30' }),
    ).toEqual(today('23:30'));
    expect(
      fitGoingOutDateTime(days, { date: '2026-10-16', time: '10:00' }),
    ).toEqual(tomorrow('10:00'));
  });
});
