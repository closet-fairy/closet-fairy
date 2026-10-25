import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from './apiError';
import {
  getIsSessionExpired,
  isUnauthorizedError,
  markSessionActive,
  reportUnauthorized,
  resetSession,
  subscribeSessionExpiry,
} from './authSession';

afterEach(() => {
  resetSession();
});

describe('세션 만료 판정', () => {
  test('로그인한 적이 없으면 401을 받아도 만료로 보지 않아야 한다.', () => {
    reportUnauthorized();

    expect(getIsSessionExpired()).toBe(false);
  });

  test('로그인한 채 401을 받으면 만료로 봐야 한다.', () => {
    markSessionActive();
    reportUnauthorized();

    expect(getIsSessionExpired()).toBe(true);
  });

  test('401이 여러 번 와도 만료 알림은 한 번만 보내야 한다.', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpiry(listener);
    markSessionActive();

    reportUnauthorized();
    reportUnauthorized();
    reportUnauthorized();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test('세션을 초기화하면 만료 상태가 풀리고, 이후의 401은 무시해야 한다.', () => {
    markSessionActive();
    reportUnauthorized();

    resetSession();
    reportUnauthorized();

    expect(getIsSessionExpired()).toBe(false);
  });
});

describe('401 오류 판별', () => {
  test('상태가 401인 ApiError만 인증 오류로 봐야 한다.', () => {
    expect(
      isUnauthorizedError(
        new ApiError({ code: 'AUTH_REQUIRED', message: '', status: 401 }),
      ),
    ).toBe(true);
    expect(
      isUnauthorizedError(
        new ApiError({ code: 'NOT_FOUND', message: '', status: 404 }),
      ),
    ).toBe(false);
    expect(isUnauthorizedError(new Error('401'))).toBe(false);
  });
});
