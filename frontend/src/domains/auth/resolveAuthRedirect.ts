export type AuthStatus = 'signedOut' | 'needsOnboarding' | 'onboarded';

const LOGIN_PATH = '/login';
const ONBOARDING_PATH = '/onboarding';
const HOME_PATH = '/closet';

type AuthRedirectPath =
  typeof LOGIN_PATH | typeof ONBOARDING_PATH | typeof HOME_PATH;

export const resolveAuthRedirect = (
  pathname: string,
  status: AuthStatus,
): AuthRedirectPath | null => {
  switch (status) {
    case 'signedOut':
      return pathname === LOGIN_PATH ? null : LOGIN_PATH;
    case 'needsOnboarding':
      return pathname === ONBOARDING_PATH ? null : ONBOARDING_PATH;
    case 'onboarded':
      return pathname === LOGIN_PATH || pathname === ONBOARDING_PATH
        ? HOME_PATH
        : null;
  }
};
