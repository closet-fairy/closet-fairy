const APP_MAX_WIDTH = 480;

export const topBarHeight = 54;

export const appFrame = {
  maxWidth: `${APP_MAX_WIDTH}px`,
  // position: fixed 요소 전용이다. 50%가 화면 폭을 가리켜야 앱 가장자리까지의 거리가 된다.
  sideInset: `max(0px, 50% - ${APP_MAX_WIDTH / 2}px)`,
} as const;

export const spacing = {
  0: '0',
  2: '2px',
  4: '4px',
  6: '6px',
  8: '8px',
  10: '10px',
  12: '12px',
  14: '14px',
  16: '16px',
  18: '18px',
  20: '20px',
  24: '24px',
  32: '32px',
  40: '40px',
} as const;

export const radius = {
  xs: '6px',
  sm: '10px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '999px',
} as const;

export const shadow = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.07)',
  md: '0 3px 10px rgba(0, 0, 0, 0.1)',
  lg: '0 6px 18px rgba(0, 0, 0, 0.16)',
  card: '0 8px 26px rgba(0, 0, 0, 0.12)',
  lifted: '0 18px 40px rgba(0, 0, 0, 0.22)',
  sheet: '0 -6px 22px rgba(0, 0, 0, 0.12)',
  app: '0 10px 40px rgba(0, 0, 0, 0.08)',
} as const;

export const opacity = {
  disabled: 0.4,
  muted: 0.55,
  faint: 0.25,
} as const;

export const zIndex = {
  sticky: 10,
  modal: 110,
  toast: 200,
} as const;
