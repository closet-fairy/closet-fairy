import { getDayOffset, getKstDate } from './goingOutTime';

const KST_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const RELATIVE_DAY_LABELS: Readonly<Partial<Record<number, string>>> = {
  [-1]: '어제',
  0: '오늘',
  1: '내일',
};

const formatHistoryDate = (date: Date, now: Date) => {
  const kstDate = getKstDate(date);
  const [year, month, day] = kstDate.split('-').map(Number);

  return (
    RELATIVE_DAY_LABELS[getDayOffset(kstDate, now)] ??
    `${year}. ${month}. ${day}`
  );
};

export const formatHistoryDateTime = (dateTime: string, now: Date) => {
  const date = new Date(dateTime);

  return `${formatHistoryDate(date, now)} ${KST_TIME_FORMAT.format(date)}`;
};

// 구간의 끝은 시작에 딸린 값이라 지금이 아니라 시작을 기준으로 다음 날을 쓴다.
export const formatHistoryGoingOutRange = (
  startAt: string,
  endAt: string,
  now: Date,
) => {
  const endDate = new Date(endAt);
  const endTime = KST_TIME_FORMAT.format(endDate);
  const isSameDay = getKstDate(new Date(startAt)) === getKstDate(endDate);

  return `${formatHistoryDateTime(startAt, now)} – ${isSameDay ? endTime : `다음 날 ${endTime}`}`;
};
