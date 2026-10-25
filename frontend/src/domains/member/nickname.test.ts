import { describe, expect, test } from 'vitest';
import { validateNickname } from './nickname';

describe('닉네임 검증', () => {
  test('비어 있거나 공백뿐이면 오류 문구를 돌려줘야 한다.', () => {
    expect(validateNickname('')).toBe('닉네임은 비워 둘 수 없습니다.');
    expect(validateNickname('   ')).toBe('닉네임은 비워 둘 수 없습니다.');
  });

  test('앞뒤 공백을 뺀 길이가 30자를 넘으면 오류 문구를 돌려줘야 한다.', () => {
    expect(validateNickname('가'.repeat(31))).toBe(
      '닉네임은 30자까지 입력할 수 있습니다.',
    );
  });

  test('앞뒤 공백을 빼고 1~30자면 통과해야 한다.', () => {
    expect(validateNickname('  김하늘  ')).toBeNull();
    expect(validateNickname('가'.repeat(30))).toBeNull();
  });
});
