export const duration = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  verySlow: '1000ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0, 1)',
  exit: 'cubic-bezier(0.3, 0, 1, 1)',
  inOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
} as const;
