import { describe, expect, test } from 'vitest';
import { MemberSettings } from '@/generated/models';
import {
  isGenderCd,
  isStyleCd,
  isTemperatureSensitivityCd,
  sortStyleCds,
  STYLE_OPTIONS,
} from './memberSettingOptions';

describe('설정 코드 판별', () => {
  test('BE가 정한 코드만 각 설정 값으로 받아들여야 한다.', () => {
    expect(isTemperatureSensitivityCd('cold_sensitive')).toBe(true);
    expect(isTemperatureSensitivityCd('cold')).toBe(false);
    expect(isGenderCd('unisex')).toBe(true);
    expect(isGenderCd('other')).toBe(false);
    expect(isStyleCd('feminine')).toBe(true);
    expect(isStyleCd('punk')).toBe(false);
  });
});

describe('선호 스타일', () => {
  test('BE가 정한 스타일마다 이름과 한 줄 설명을 가져야 한다.', () => {
    expect(STYLE_OPTIONS.map((option) => option.value)).toEqual(
      MemberSettings.shape.style_cds.element.options,
    );
    expect(
      STYLE_OPTIONS.every(
        (option) => option.label !== '' && option.description !== '',
      ),
    ).toBe(true);
  });

  test('고른 순서와 상관없이 스타일 목록 순서대로 정렬해야 한다.', () => {
    expect(sortStyleCds(['classic', 'minimal', 'feminine'])).toEqual([
      'minimal',
      'classic',
      'feminine',
    ]);
  });
});
