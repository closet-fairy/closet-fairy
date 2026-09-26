import { setupWorker } from 'msw/browser';
import type { UnhandledRequestCallback } from 'msw';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export const warnOnUnhandledApiRequest: UnhandledRequestCallback = (
  request,
  print,
) => {
  if (new URL(request.url).pathname.startsWith('/api/')) {
    print.warning();
  }
};
