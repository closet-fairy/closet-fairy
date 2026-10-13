import { describe, expect, test } from 'vitest';
import {
  createEndTimeSlots,
  createStartTimeSlots,
  createTimeSlots,
  getCurrentTimeSlot,
  getDefaultEndTime,
  getMillisecondsUntilNextTimeSlot,
  isNextDayReturn,
  isPastTimeSlot,
  validateGoingOutTime,
} from './goingOutTime';

const at = (time: string) => new Date(`2026-10-14T${time}:00+09:00`);

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
      validateGoingOutTime({ start: '15:00', end: '15:00', now: at('14:10') }),
    ).toBe('외출 시작과 종료 시각이 같습니다.');
  });

  test('나가는 시간이 현재 슬롯보다 이르면 실패해야 한다.', () => {
    expect(
      validateGoingOutTime({ start: '13:30', end: '18:00', now: at('14:10') }),
    ).toBe('외출 시작 시각이 이미 지났습니다.');
  });

  test('나가는 시간이 지났고 돌아오는 시간과도 같으면, BE처럼 같은 시각 문제를 먼저 알려야 한다.', () => {
    expect(
      validateGoingOutTime({ start: '13:00', end: '13:00', now: at('14:10') }),
    ).toBe('외출 시작과 종료 시각이 같습니다.');
  });

  test('나가는 시간이 현재 슬롯과 같으면 통과해야 한다.', () => {
    expect(
      validateGoingOutTime({ start: '14:00', end: '18:00', now: at('14:10') }),
    ).toBeNull();
  });

  test('돌아오는 시간이 나가는 시간보다 이르면 다음 날 귀가로 보고 통과해야 한다.', () => {
    expect(
      validateGoingOutTime({ start: '22:00', end: '01:00', now: at('14:10') }),
    ).toBeNull();
  });
});
