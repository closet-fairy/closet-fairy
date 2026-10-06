import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/mocks/node';

const unhandledRequests: string[] = [];

beforeAll(() => {
  server.listen({
    onUnhandledRequest: (request, print) => {
      unhandledRequests.push(`${request.method} ${request.url}`);
      print.error();
    },
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();

  if (unhandledRequests.length > 0) {
    const requests = unhandledRequests.splice(0).join(', ');
    throw new Error(`핸들러가 없는 요청이 있습니다: ${requests}`);
  }
});

afterAll(() => {
  server.close();
});
