import { describe, expect, test } from 'vitest';
import { resolveAuthRedirect } from './resolveAuthRedirect';

describe('로그인하지 않은 사용자', () => {
  test('로그인 화면이 아닌 곳에 들어오면 로그인 화면으로 보내야 한다.', () => {
    expect(resolveAuthRedirect('/closet', 'signedOut')).toBe('/login');
    expect(resolveAuthRedirect('/onboarding', 'signedOut')).toBe('/login');
    expect(resolveAuthRedirect('/my-info/edit', 'signedOut')).toBe('/login');
  });

  test('로그인 화면에서는 그대로 머물러야 한다.', () => {
    expect(resolveAuthRedirect('/login', 'signedOut')).toBeNull();
  });
});

describe('온보딩을 마치지 않은 사용자', () => {
  test('온보딩이 아닌 곳에 들어오면 온보딩으로 보내야 한다.', () => {
    expect(resolveAuthRedirect('/closet', 'needsOnboarding')).toBe(
      '/onboarding',
    );
    expect(resolveAuthRedirect('/my-info', 'needsOnboarding')).toBe(
      '/onboarding',
    );
    expect(resolveAuthRedirect('/login', 'needsOnboarding')).toBe(
      '/onboarding',
    );
  });

  test('온보딩에서는 그대로 머물러야 한다.', () => {
    expect(resolveAuthRedirect('/onboarding', 'needsOnboarding')).toBeNull();
  });
});

describe('온보딩을 마친 사용자', () => {
  test('로그인 화면이나 온보딩에 들어오면 옷장으로 보내야 한다.', () => {
    expect(resolveAuthRedirect('/login', 'onboarded')).toBe('/closet');
    expect(resolveAuthRedirect('/onboarding', 'onboarded')).toBe('/closet');
  });

  test('그 밖의 화면에서는 그대로 머물러야 한다.', () => {
    expect(resolveAuthRedirect('/closet', 'onboarded')).toBeNull();
    expect(resolveAuthRedirect('/my-info', 'onboarded')).toBeNull();
    expect(resolveAuthRedirect('/closet/3/edit', 'onboarded')).toBeNull();
  });
});
