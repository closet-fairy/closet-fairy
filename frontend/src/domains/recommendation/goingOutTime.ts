import type { RecommendationSessionCreate } from '@/generated/models';
import { formatMinutesToTime } from '@/utils/formatMinutesToTime';
import { parseTimeToMinutes } from '@/utils/parseTimeToMinutes';

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
const SLOT_MILLISECONDS = SLOT_MINUTES * 60 * 1000;
const DEFAULT_GOING_OUT_MINUTES = 5 * 60;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

// BE가 외출 시간을 KST 기준 오늘로 해석하므로, 기기 시간대와 상관없이 KST 시각을 쓴다.
const KST_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type GoingOutDateCd = NonNullable<
  RecommendationSessionCreate['going_out_date_cd']
>;

export interface GoingOutStart {
  date: string;
  time: string;
}

export const getKstDate = (now: Date) => {
  const parts = KST_DATE_FORMAT.formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
};

const getKstMidnight = (date: string) => Date.parse(`${date}T00:00:00+09:00`);

export const shiftKstDate = (date: string, days: number) =>
  getKstDate(new Date(getKstMidnight(date) + days * DAY_MILLISECONDS));

export const getDayOffset = (date: string, now: Date) =>
  Math.round(
    (getKstMidnight(date) - getKstMidnight(getKstDate(now))) / DAY_MILLISECONDS,
  );

export const getGoingOutDateCd = (
  date: string,
  now: Date,
): GoingOutDateCd | null => {
  const dayOffset = getDayOffset(date, now);

  if (dayOffset === 0) {
    return 'today';
  }

  if (dayOffset === 1) {
    return 'tomorrow';
  }

  return null;
};

const getKstMinutesOfDay = (now: Date) => {
  const parts = KST_TIME_FORMAT.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);

  return hour * 60 + minute;
};

export const createTimeSlots = () =>
  Array.from({ length: SLOTS_PER_DAY }, (_, index) =>
    formatMinutesToTime(index * SLOT_MINUTES),
  );

export const getCurrentTimeSlot = (now: Date) => {
  const minutes = getKstMinutesOfDay(now);

  return formatMinutesToTime(minutes - (minutes % SLOT_MINUTES));
};

export const getDefaultEndTime = (start: string) =>
  formatMinutesToTime(parseTimeToMinutes(start) + DEFAULT_GOING_OUT_MINUTES);

export const isPastTimeSlot = (time: string, now: Date) =>
  parseTimeToMinutes(time) < parseTimeToMinutes(getCurrentTimeSlot(now));

export const createStartTimeSlots = (now: Date) =>
  createTimeSlots().filter((slot) => !isPastTimeSlot(slot, now));

export const createStartOptions = (now: Date): GoingOutStart[] => {
  const today = getKstDate(now);
  const tomorrow = shiftKstDate(today, 1);

  return [
    ...createStartTimeSlots(now).map((time) => ({ date: today, time })),
    ...createTimeSlots().map((time) => ({ date: tomorrow, time })),
  ];
};

export const createEndTimeSlots = (start: string) => {
  const startMinutes = parseTimeToMinutes(start);

  return Array.from({ length: SLOTS_PER_DAY - 1 }, (_, index) =>
    formatMinutesToTime(startMinutes + (index + 1) * SLOT_MINUTES),
  );
};

// KST는 UTC와 정시 단위로 차이 나므로, KST의 30분 경계는 epoch 기준 30분 경계와 같다.
export const getMillisecondsUntilNextTimeSlot = (now: Date) =>
  SLOT_MILLISECONDS - (now.getTime() % SLOT_MILLISECONDS);

export const isNextDayReturn = (start: string, end: string) =>
  parseTimeToMinutes(end) < parseTimeToMinutes(start);

interface ValidateGoingOutTimeParams {
  start: GoingOutStart;
  end: string;
  now: Date;
}

export const validateGoingOutTime = (params: ValidateGoingOutTimeParams) => {
  const { start, end, now } = params;

  if (start.time === end) {
    return '외출 시작과 종료 시각이 같습니다.';
  }

  const dayOffset = getDayOffset(start.date, now);

  if (dayOffset < 0 || (dayOffset === 0 && isPastTimeSlot(start.time, now))) {
    return '외출 시작 시각이 이미 지났습니다.';
  }

  if (dayOffset > 1) {
    return '외출 날짜는 오늘이나 내일만 고를 수 있습니다.';
  }

  return null;
};
