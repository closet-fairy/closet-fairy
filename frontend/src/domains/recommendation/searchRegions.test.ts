import { describe, expect, test } from 'vitest';
import { searchRegions } from './searchRegions';

const REGIONS = [
  { sido_nm: '서울특별시', sigungu_nms: ['종로구', '중구', '성동구'] },
  { sido_nm: '부산광역시', sigungu_nms: ['중구', '해운대구'] },
  { sido_nm: '세종특별자치시', sigungu_nms: ['세종특별자치시'] },
  {
    sido_nm: '경기도',
    sigungu_nms: ['수원시 장안구', '수원시 권선구', '성남시 분당구'],
  },
];

const fullNamesOf = (query: string) =>
  searchRegions(REGIONS, query).map((result) => result.fullName);

describe('지역 검색', () => {
  test('검색어가 비어 있거나 공백뿐이면 결과가 없어야 한다.', () => {
    expect(searchRegions(REGIONS, '')).toEqual([]);
    expect(searchRegions(REGIONS, '  ')).toEqual([]);
  });

  test('시·군·구 이름 일부로 찾으면 시·도와 시·군·구를 함께 돌려줘야 한다.', () => {
    expect(searchRegions(REGIONS, '성동')).toEqual([
      {
        sidoNm: '서울특별시',
        sigunguNm: '성동구',
        fullName: '서울특별시 성동구',
      },
    ]);
  });

  test('같은 이름의 시·군·구가 여러 시·도에 있으면 모두 목록 순서대로 돌려줘야 한다.', () => {
    expect(fullNamesOf('중구')).toEqual(['서울특별시 중구', '부산광역시 중구']);
  });

  test('시·도 이름으로 찾으면 그 시·도의 시·군·구를 모두 돌려줘야 한다.', () => {
    expect(fullNamesOf('서울')).toEqual([
      '서울특별시 종로구',
      '서울특별시 중구',
      '서울특별시 성동구',
    ]);
  });

  test('시·도 짧은 이름과 시·군·구를 이어 적어도 찾아야 한다.', () => {
    expect(fullNamesOf('서울 성동')).toEqual(['서울특별시 성동구']);
    expect(fullNamesOf('경기 수원')).toEqual([
      '경기도 수원시 장안구',
      '경기도 수원시 권선구',
    ]);
  });

  test('띄어쓰기가 달라도 찾아야 한다.', () => {
    expect(fullNamesOf('수원시장안')).toEqual(['경기도 수원시 장안구']);
    expect(fullNamesOf('서울특별시성동구')).toEqual(['서울특별시 성동구']);
  });

  test('시·군·구 이름이 시·도 이름과 같으면 정식 이름을 한 번만 보여야 한다.', () => {
    expect(searchRegions(REGIONS, '세종')).toEqual([
      {
        sidoNm: '세종특별자치시',
        sigunguNm: '세종특별자치시',
        fullName: '세종특별자치시',
      },
    ]);
  });

  test('특별시·광역시·특별자치시는 "서울시"처럼 시를 붙인 이름으로도 찾아야 한다.', () => {
    expect(fullNamesOf('서울시 성동구')).toEqual(['서울특별시 성동구']);
    expect(fullNamesOf('부산시 해운대')).toEqual(['부산광역시 해운대구']);
    expect(fullNamesOf('세종시')).toEqual(['세종특별자치시']);
  });

  test('띄어 적은 낱말은 순서대로 붙어 있지 않아도 모두 들어 있으면 찾아야 한다.', () => {
    expect(fullNamesOf('수원 장안구')).toEqual(['경기도 수원시 장안구']);
  });

  test('낱말 하나라도 맞지 않으면 찾지 않아야 한다.', () => {
    expect(fullNamesOf('서울 해운대')).toEqual([]);
  });

  test('맞는 지역이 없으면 빈 목록을 돌려줘야 한다.', () => {
    expect(searchRegions(REGIONS, '런던')).toEqual([]);
  });
});
