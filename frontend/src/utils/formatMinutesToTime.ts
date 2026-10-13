const MINUTES_PER_DAY = 24 * 60;

export const formatMinutesToTime = (minutes: number) => {
  const minutesOfDay =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(minutesOfDay / 60);
  const restMinutes = minutesOfDay % 60;

  return `${String(hours).padStart(2, '0')}:${String(restMinutes).padStart(2, '0')}`;
};
