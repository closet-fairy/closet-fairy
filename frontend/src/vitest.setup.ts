import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { resetClothingMocks } from '@/mocks/handlers/clothing';
import { server } from '@/mocks/node';

// jsdom에는 ResizeObserver가 없어서, 크기 변화를 지켜보는 컴포넌트가 테스트에서 멈추지 않도록 빈 구현을 둔다.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

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
  resetClothingMocks();

  if (unhandledRequests.length > 0) {
    const requests = unhandledRequests.splice(0).join(', ');
    throw new Error(`핸들러가 없는 요청이 있습니다: ${requests}`);
  }
});

afterAll(() => {
  server.close();
});
