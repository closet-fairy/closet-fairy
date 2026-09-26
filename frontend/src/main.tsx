import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient } from '@/apis/queryClient';
import { routeTree } from './routeTree.gen';
import 'wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css';

const router = createRouter({
  routeTree,
  context: { queryClient },
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
    showDevErrorOverlay(error);
    console.error(error);
  },
);
