import { describe, expect, test } from 'vitest';
import {
  formatRegionFullName,
  formatRegionLabel,
  getSidoShortName,
} from './regionLabel';

describe('시·도 짧은 이름', () => {
  test.each([
    ['서울특별시', '서울'],
    ['경기도', '경기'],
    ['강원특별자치도', '강원'],
    ['전북특별자치도', '전북'],
    ['충청남도', '충남'],
    ['제주특별자치도', '제주'],
  ])('%s는 %s로 줄여야 한다.', (sidoNm, shortName) => {
    expect(getSidoShortName(sidoNm)).toBe(shortName);
  });

  test('모르는 시·도 이름은 그대로 돌려줘야 한다.', () => {
    expect(getSidoShortName('없는도')).toBe('없는도');
  });
});

describe('위치 필드 라벨', () => {
  test('시·도는 짧은 이름으로, 시·군·구는 그대로 붙여야 한다.', () => {
    expect(formatRegionLabel('서울특별시', '성동구')).toBe('서울 성동구');
    expect(formatRegionLabel('경기도', '수원시 장안구')).toBe(
      '경기 수원시 장안구',
    );
  });

  test('시·군·구 이름이 시·도 이름과 같으면 시·도 짧은 이름만 보여야 한다.', () => {
    expect(formatRegionLabel('세종특별자치시', '세종특별자치시')).toBe('세종');
  });
});

describe('지역 정식 이름', () => {
  test('시·도와 시·군·구를 정식 이름 그대로 이어야 한다.', () => {
    expect(formatRegionFullName('서울특별시', '성동구')).toBe(
      '서울특별시 성동구',
    );
  });

  test('시·군·구 이름이 시·도 이름과 같으면 한 번만 보여야 한다.', () => {
    expect(formatRegionFullName('세종특별자치시', '세종특별자치시')).toBe(
      '세종특별자치시',
    );
  });
});
