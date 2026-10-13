import { formatMinutesToTime } from '@/utils/formatMinutesToTime';
import { parseTimeToMinutes } from '@/utils/parseTimeToMinutes';

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
const DEFAULT_GOING_OUT_MINUTES = 5 * 60;

// BE가 외출 시간을 KST 기준 오늘로 해석하므로, 기기 시간대와 상관없이 KST 시각을 쓴다.
const KST_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

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

export const getDefaultGoingOutTime = (now: Date) => {
  const start = getCurrentTimeSlot(now);
  const end = formatMinutesToTime(
    parseTimeToMinutes(start) + DEFAULT_GOING_OUT_MINUTES,
  );

  return { start, end };
};

export const isNextDayReturn = (start: string, end: string) =>
  parseTimeToMinutes(end) < parseTimeToMinutes(start);

interface ValidateGoingOutTimeParams {
  start: string;
  end: string;
  now: Date;
}

export const validateGoingOutTime = (params: ValidateGoingOutTimeParams) => {
  const { start, end, now } = params;

  if (start === end) {
    return '외출 시작과 종료 시각이 같습니다.';
  }

  if (parseTimeToMinutes(start) < parseTimeToMinutes(getCurrentTimeSlot(now))) {
    return '외출 시작 시각이 이미 지났습니다.';
  }

  return null;
};
