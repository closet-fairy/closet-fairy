import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient } from '@/apis/queryClient';
import { routeTree } from './routeTree.gen';
import '@fontsource-variable/asta-sans';

const router = createRouter({
  routeTree,
  context: { queryClient },
  // 뒤로 가기로 돌아온 화면은 보던 위치로 되돌린다. 새로 들어가는 화면은 맨 위에서 시작한다.
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const enableMocking = async () => {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK !== 'true') {
    return;
  }

  const { worker, warnOnUnhandledApiRequest } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: warnOnUnhandledApiRequest });
};

const showDevErrorOverlay = (error: unknown) => {
  const ErrorOverlay = customElements.get('vite-error-overlay');

  if (ErrorOverlay !== undefined) {
    document.body.appendChild(new ErrorOverlay(error));
  }
};

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('#root 요소를 찾을 수 없습니다.');
}

void enableMocking().then(
  () => {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    );
  },
  (error: unknown) => {
    console.error(error);
    showDevErrorOverlay(error);
  },
);
