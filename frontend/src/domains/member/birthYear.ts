const MIN_AGE = 14;
const BIRTH_YEAR_SPAN = 100;

const KST_YEAR_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
});

export const getKstYear = (now: Date) => {
  const year = KST_YEAR_FORMAT.formatToParts(now).find(
    (part) => part.type === 'year',
  )?.value;

  return Number(year);
};

export const getLatestAllowedBirthYear = (currentYear: number) =>
  currentYear - MIN_AGE - 1;

export const createBirthYearOptions = (currentYear: number) => {
  const latestYear = getLatestAllowedBirthYear(currentYear);
  const earliestYear = currentYear - BIRTH_YEAR_SPAN;

  return Array.from(
    { length: latestYear - earliestYear + 1 },
    (_, index) => latestYear - index,
  );
};

export const toAgeGroup = (birthYear: number, currentYear: number) =>
  `${Math.floor((currentYear - birthYear) / 10) * 10}대`;
