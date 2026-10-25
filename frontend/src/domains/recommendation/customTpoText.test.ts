import { describe, expect, test } from 'vitest';
import {
  CUSTOM_TPO_TEXT_MAX_LENGTH,
  isCustomTpoTextValid,
} from './customTpoText';

describe('직접 입력한 상황 문구 검증', () => {
  test('글자가 있으면 설정할 수 있어야 한다.', () => {
    expect(isCustomTpoTextValid('학교 발표')).toBe(true);
  });

  test('비어 있거나 공백뿐이면 설정할 수 없어야 한다.', () => {
    expect(isCustomTpoTextValid('')).toBe(false);
    expect(isCustomTpoTextValid('   ')).toBe(false);
  });

  test('BE 스펙의 최대 글자 수까지는 설정할 수 있고, 넘으면 설정할 수 없어야 한다.', () => {
    expect(isCustomTpoTextValid('가'.repeat(CUSTOM_TPO_TEXT_MAX_LENGTH))).toBe(
      true,
    );
    expect(
      isCustomTpoTextValid('가'.repeat(CUSTOM_TPO_TEXT_MAX_LENGTH + 1)),
    ).toBe(false);
  });

  test('이모지처럼 두 칸을 차지하는 글자도 한 글자로 세야 한다.', () => {
    expect(isCustomTpoTextValid('😀'.repeat(CUSTOM_TPO_TEXT_MAX_LENGTH))).toBe(
      true,
    );
  });
});
