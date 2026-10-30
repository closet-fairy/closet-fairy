import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';
import {
  isWebGL2Supported,
  UNSUPPORTED_MESSAGE,
} from './renderer/createEditorRenderer';
import type * as EditorRenderer from './renderer/createEditorRenderer';

// jsdom에는 WebGL이 없어서, 지원 여부만 테스트마다 정한다.
vi.mock(
  '@/pages/ClothingImageEditor/renderer/createEditorRenderer',
  async (importOriginal) => ({
    ...(await importOriginal<typeof EditorRenderer>()),
    isWebGL2Supported: vi.fn(() => true),
  }),
);

const renderAt = async (path: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
  });
  // 경로 컴포넌트는 나눠서 불러오므로, 첫 화면을 그리기 전에 불러오기를 끝낸다.
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { history };
};

beforeEach(() => {
  vi.mocked(isWebGL2Supported).mockReturnValue(true);
});

describe('편집 전 안내', () => {
  test('WebGL2를 쓸 수 없으면 옷을 조회하지 않고 안내해야 한다.', async () => {
    vi.mocked(isWebGL2Supported).mockReturnValue(false);
    const clothingRequests: string[] = [];
    const handleRequest = ({ request }: { request: Request }) => {
      const path = new URL(request.url).pathname;

      if (path.startsWith('/api/clothing')) {
        clothingRequests.push(path);
      }
    };
    server.events.on('request:start', handleRequest);

    try {
      await renderAt('/closet/1/edit');

      expect(await screen.findByText(UNSUPPORTED_MESSAGE)).toBeInTheDocument();
      expect(clothingRequests).toHaveLength(0);
    } finally {
      server.events.removeListener('request:start', handleRequest);
    }
  });

  test('없는 옷이면 안내하고, 확인을 누르면 옷장으로 돌아가야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderAt('/closet/999/edit');

    expect(
      await screen.findByRole('dialog', { name: '옷을 찾을 수 없어요' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
  });

  test('처리가 끝나지 않은 옷이면 편집하지 않고 안내해야 한다.', async () => {
    server.use(
      http.get('/api/clothing/:clothingId', () =>
        HttpResponse.json({
          clothing_id: 7,
          processing_status_cd: 'processing',
          is_queued: true,
          image_url: '/media/clothing/1/sample.webp',
          failure_reason: null,
          is_new: true,
          category_cd: null,
          item_name: null,
          created_at: '2026-10-25T10:00:00+09:00',
          origin_image_url: '/media/clothing/1/sample.webp',
          cutout_image_url: null,
          accessory_type_cd: null,
          color_cd: null,
          color_text: null,
          thickness_cd: null,
          is_waterproof: null,
          style_cds: [],
          season_cds: [],
          edit: null,
        }),
      ),
    );
    await renderAt('/closet/7/edit');

    expect(
      await screen.findByText('사진을 처리하고 있어요'),
    ).toBeInTheDocument();
  });

  test('조회에 실패하면 서버 메시지와 다시 시도를 보여 줘야 한다.', async () => {
    server.use(
      http.get('/api/clothing/:clothingId', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    await renderAt('/closet/1/edit');

    expect(
      await screen.findByText('처리 중 오류가 발생했습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  });
});
