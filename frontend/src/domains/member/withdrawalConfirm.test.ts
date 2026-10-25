import { describe, expect, test } from 'vitest';
import { isWithdrawalConfirmed } from './withdrawalConfirm';

describe('탈퇴 동의 문구', () => {
  test('"탈퇴합니다"를 정확히 입력해야 동의로 봐야 한다.', () => {
    expect(isWithdrawalConfirmed('탈퇴합니다')).toBe(true);
    expect(isWithdrawalConfirmed(' 탈퇴합니다 ')).toBe(true);
  });

  test('문구가 다르거나 덜 입력됐으면 동의로 보지 않아야 한다.', () => {
    expect(isWithdrawalConfirmed('')).toBe(false);
    expect(isWithdrawalConfirmed('탈퇴합니')).toBe(false);
    expect(isWithdrawalConfirmed('탈퇴 합니다')).toBe(false);
  });
});
