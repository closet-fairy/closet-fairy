import { describe, expect, test } from 'vitest';
import {
  createBirthYearOptions,
  getKstYear,
  getLatestAllowedBirthYear,
  toAgeGroup,
} from './birthYear';

describe('KST 연도', () => {
  test('UTC로는 아직 전년도여도 KST로 해가 바뀌었으면 새 연도를 돌려줘야 한다.', () => {
    expect(getKstYear(new Date('2026-12-31T15:30:00Z'))).toBe(2027);
  });

  test('KST로 아직 해가 바뀌지 않았으면 그해를 돌려줘야 한다.', () => {
    expect(getKstYear(new Date('2026-12-31T14:59:00Z'))).toBe(2026);
  });
});

describe('출생연도 선택지', () => {
  test('만 14세 미만으로 볼 수 있는 해는 선택지에 넣지 않아야 한다.', () => {
    expect(getLatestAllowedBirthYear(2026)).toBe(2011);
    expect(createBirthYearOptions(2026)).not.toContain(2012);
  });

  test('올해−15년부터 올해−100년까지 최신 연도부터 내림차순이어야 한다.', () => {
    const options = createBirthYearOptions(2026);

    expect(options.at(0)).toBe(2011);
    expect(options.at(-1)).toBe(1926);
    expect(options).toHaveLength(86);
    expect(options).toEqual([...options].sort((a, b) => b - a));
  });
});

describe('연령대', () => {
  test('올해와 출생연도의 차이를 10단위로 내려 연령대로 바꿔야 한다.', () => {
    expect(toAgeGroup(2001, 2026)).toBe('20대');
    expect(toAgeGroup(1996, 2026)).toBe('30대');
    expect(toAgeGroup(2011, 2026)).toBe('10대');
  });
});
