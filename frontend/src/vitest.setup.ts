import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { resetSession } from '@/apis/authSession';
import { resetClothingMocks } from '@/mocks/handlers/clothing';
import { resetMemberMocks } from '@/mocks/handlers/member';
import { resetRecommendationMocks } from '@/mocks/handlers/recommendation';
import { server } from '@/mocks/node';
import { resetClothingUploads } from '@/pages/Closet/clothingUploadStore';

// jsdom에는 ResizeObserver가 없어서, 크기 변화를 지켜보는 컴포넌트가 테스트에서 멈추지 않도록 빈 구현을 둔다.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// IntersectionObserver도 jsdom에 없다. 목록 끝에 닿는 동작을 확인할 테스트는 자기 파일에서 다시 덮어쓴다.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// 라우터의 스크롤 복원이 부르는 window.scrollTo를 jsdom은 구현하지 않아 경고만 남기므로 막아 둔다.
window.scrollTo = () => {};

// jsdom은 URL.createObjectURL을 구현하지 않아, 고른 사진의 미리보기 주소를 흉내 낸다.
let objectUrlCount = 0;
URL.createObjectURL = () => {
  objectUrlCount += 1;
  return `blob:test/${objectUrlCount}`;
};
URL.revokeObjectURL = () => {};

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
  resetMemberMocks();
  resetRecommendationMocks();
  resetClothingUploads();
  resetSession();

  if (unhandledRequests.length > 0) {
    const requests = unhandledRequests.splice(0).join(', ');
    throw new Error(`핸들러가 없는 요청이 있습니다: ${requests}`);
  }
});

afterAll(() => {
  server.close();
});
