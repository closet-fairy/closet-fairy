import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getListClothingClothingGetInfiniteQueryKey } from '@/generated/endpoints/clothing/clothing';
import type {
  ClothingCard,
  ClothingPage,
  ClothingProgress,
} from '@/generated/models';
import { server } from '@/mocks/node';
import { CLOSET_LIST_PARAMS } from '@/pages/Closet/constants';
import { routeTree } from '@/routeTree.gen';

type IntersectionCallback = (entries: { isIntersecting: boolean }[]) => void;

// 목록 끝 요소가 화면에 들어온 순간을 테스트에서 직접 일으킬 수 있게 관찰 콜백을 모아 둔다.
const intersectionCallbacks = new Set<IntersectionCallback>();

const scrollToListEnd = () => {
  act(() => {
    for (const callback of intersectionCallbacks) {
      callback([{ isIntersecting: true }]);
    }
  });
};

/*
 * MSW 목록의 편집기용 옷 5벌은 이름이 모두 같고, 두 번째 묶음(4벌)과 세 번째 묶음(1벌)에만 있다.
 * 묶음은 20벌씩이고 전체는 41벌이다.
 */
const SECOND_PAGE_ITEM_NAME = '스트라이프 반팔 티셔츠';
const SECOND_PAGE_ITEM_TOTAL = 5;

// true면 관찰을 시작하자마자 목록 끝이 화면 안에 있다고 알린다. 끝 요소가 계속 보이는 상황을 흉내 낸다.
let isListEndAlwaysVisible = false;

beforeEach(() => {
  intersectionCallbacks.clear();
  isListEndAlwaysVisible = false;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly callback: IntersectionCallback;

      constructor(callback: IntersectionCallback) {
        this.callback = callback;
      }

      observe() {
        intersectionCallbacks.add(this.callback);

        if (isListEndAlwaysVisible) {
          this.callback([{ isIntersecting: true }]);
        }
      }

      disconnect() {
        intersectionCallbacks.delete(this.callback);
      }
    },
  );
});

const renderCloset = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: ['/closet'] });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { queryClient };
};

const emptyPage: ClothingPage = { items: [], next_cursor: null };

describe('옷장 목록', () => {
  test('카드마다 처리 상태에 맞는 모습을 보여야 한다.', async () => {
    await renderCloset();

    expect(await screen.findByText('처리 중')).toBeInTheDocument();
    expect(screen.getByText('대기 중')).toBeInTheDocument();
    expect(screen.getByText('등록 실패')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재시도' })).toBeInTheDocument();
    expect(screen.getByText('이름 없음')).toBeInTheDocument();
    expect(screen.getByText('분류 없음')).toBeInTheDocument();
    expect(screen.getAllByText('신규').length).toBeGreaterThan(0);
  });

  test('목록 끝에 닿으면 다음 묶음을 이어 불러와야 한다.', async () => {
    await renderCloset();
    await screen.findByText('처리 중');
    expect(screen.queryByText(SECOND_PAGE_ITEM_NAME)).not.toBeInTheDocument();

    scrollToListEnd();

    expect(
      (await screen.findAllByText(SECOND_PAGE_ITEM_NAME)).length,
    ).toBeGreaterThan(0);
  });

  test('다음 묶음을 불러오지 못하면 목록 끝에서 다시 시도할 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    await renderCloset();
    await screen.findByText('처리 중');

    server.use(
      http.get('/api/clothing', ({ request }) =>
        new URL(request.url).searchParams.has('cursor')
          ? HttpResponse.json(
              {
                code: 'INTERNAL_ERROR',
                message: '처리 중 오류가 발생했습니다.',
              },
              { status: 500 },
            )
          : undefined,
      ),
    );
    scrollToListEnd();

    expect(await screen.findByText('더 불러오지 못했어요')).toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(
      (await screen.findAllByText(SECOND_PAGE_ITEM_NAME)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('더 불러오지 못했어요')).not.toBeInTheDocument();
  });

  test('목록 끝이 계속 화면 안에 있으면 마지막 묶음까지 이어 불러와야 한다.', async () => {
    isListEndAlwaysVisible = true;
    await renderCloset();

    await waitFor(() => {
      expect(screen.getAllByText(SECOND_PAGE_ITEM_NAME)).toHaveLength(
        SECOND_PAGE_ITEM_TOTAL,
      );
    });
  });
});

describe('빈 옷장과 불러오기 실패', () => {
  test('옷이 하나도 없으면 빈 옷장 안내와 등록 버튼을 보여야 한다.', async () => {
    server.use(http.get('/api/clothing', () => HttpResponse.json(emptyPage)));
    await renderCloset();

    expect(await screen.findByText('옷장이 비어 있어요')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '옷 등록하기' }),
    ).toBeInTheDocument();
  });

  test('처음 불러오기에 실패하면 서버 문구와 다시 시도를 보여야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/clothing', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    await renderCloset();

    expect(
      await screen.findByText('옷장을 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('처리 중 오류가 발생했습니다.'),
    ).toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('처리 중')).toBeInTheDocument();
  });

  test('로그인이 만료되어 불러오지 못하면 실패 화면 대신 로딩 화면을 유지해야 한다.', async () => {
    server.use(
      http.get('/api/clothing', () =>
        HttpResponse.json(
          { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
          { status: 401 },
        ),
      ),
    );
    const { queryClient } = await renderCloset();

    await waitFor(() => {
      expect(
        queryClient.getQueryState(
          getListClothingClothingGetInfiniteQueryKey(CLOSET_LIST_PARAMS),
        )?.status,
      ).toBe('error');
    });
    // 쿼리가 실패로 바뀐 뒤 화면이 다시 그려질 때까지 기다린다.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.getByText('옷장을 불러오는 중이에요')).toBeInTheDocument();
    expect(
      screen.queryByText('옷장을 불러오지 못했어요'),
    ).not.toBeInTheDocument();
  });
});

const LIST_REFETCH_DELAY_MS = 1500;

const readStatusIds = (request: Request) =>
  (new URL(request.url).searchParams.get('ids') ?? '').split(',').map(Number);

const toProgress = (
  clothingId: number,
  progress: Partial<ClothingProgress>,
): ClothingProgress => ({
  clothing_id: clothingId,
  processing_status_cd: 'processing',
  is_queued: false,
  image_url: '/media/clothing/1/sample.webp',
  failure_reason: null,
  ...progress,
});

const toCompletedCard = (clothingId: number): ClothingCard => ({
  ...toProgress(clothingId, { processing_status_cd: 'completed' }),
  is_new: true,
  category_cd: 'top',
  item_name: `완료된 옷 ${clothingId}`,
  created_at: '2026-10-29T10:00:00+09:00',
});

describe('처리 상태 갱신', () => {
  test('처리가 끝난 옷이 생기면 목록을 다시 받아 이름을 채우고, 다시 받는 동안에는 상태를 묻지 않아야 한다.', async () => {
    let listRequestCount = 0;
    let statusRequestCount = 0;
    let finishedIds: number[] = [];
    server.use(
      http.get('/api/clothing/status', ({ request }) => {
        statusRequestCount += 1;
        finishedIds = readStatusIds(request);

        return HttpResponse.json({
          items: finishedIds.map((id) =>
            toProgress(id, { processing_status_cd: 'completed' }),
          ),
        });
      }),
      http.get('/api/clothing', async () => {
        listRequestCount += 1;

        if (finishedIds.length === 0) {
          return undefined;
        }

        // 폴링 간격보다 오래 걸리게 해서, 그사이 상태를 다시 묻지 않는지 본다.
        await delay(LIST_REFETCH_DELAY_MS);

        return HttpResponse.json<ClothingPage>({
          items: finishedIds.map(toCompletedCard),
          next_cursor: null,
        });
      }),
    );
    await renderCloset();

    expect(
      await screen.findAllByText(
        /^완료된 옷 /,
        {},
        { timeout: LIST_REFETCH_DELAY_MS * 2 },
      ),
    ).toHaveLength(2);
    expect(screen.queryByText('처리 중')).not.toBeInTheDocument();
    expect(statusRequestCount).toBe(1);
    expect(listRequestCount).toBe(2);
  });

  test('대기 중이던 옷이 처리를 시작하면 목록을 다시 받지 않고 카드만 바꿔야 한다.', async () => {
    let listRequestCount = 0;
    server.use(
      http.get('/api/clothing/status', ({ request }) =>
        HttpResponse.json({
          items: readStatusIds(request).map((id) => toProgress(id, {})),
        }),
      ),
      http.get('/api/clothing', () => {
        listRequestCount += 1;
        return undefined;
      }),
    );
    await renderCloset();
    await screen.findByText('대기 중');

    await waitFor(() => {
      expect(screen.queryByText('대기 중')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('처리 중')).toHaveLength(2);
    expect(listRequestCount).toBe(1);
  });
});

describe('처리 중·실패 카드 다이얼로그', () => {
  test('처리 중인 카드를 누르면 아직 처리 중이라는 다이얼로그를 띄워야 한다.', async () => {
    const user = userEvent.setup();
    await renderCloset();

    await user.click(
      await screen.findByRole('button', { name: '처리 중인 옷' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: '아직 처리 중이에요',
    });
    await user.click(within(dialog).getByRole('button', { name: '닫기' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '아직 처리 중이에요' }),
      ).not.toBeInTheDocument();
    });
  });

  test('실패 카드를 누르면 서버가 준 사유를 보여 주고, 재시도하면 닫히며 카드가 대기 중으로 바뀌어야 한다.', async () => {
    const user = userEvent.setup();
    await renderCloset();

    await user.click(
      await screen.findByRole('button', { name: '등록에 실패한 옷' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: '등록하지 못했어요',
    });
    expect(dialog).toHaveAccessibleDescription('배경 제거에 실패했습니다.');

    await user.click(within(dialog).getByRole('button', { name: '재시도' }));

    // 실패 다이얼로그가 처리 중 다이얼로그로 바뀌어 남지 않고 닫혀야 한다.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('등록 실패')).not.toBeInTheDocument();
    expect(screen.getAllByText('대기 중')).toHaveLength(2);
  });

  test('재시도 요청이 나가 있는 동안에는 카드의 재시도 버튼을 다시 누를 수 없어야 한다.', async () => {
    const user = userEvent.setup();
    let retryRequestCount = 0;
    server.use(
      http.post('/api/clothing/:clothingId/retry', async () => {
        retryRequestCount += 1;
        await delay('infinite');
      }),
    );
    await renderCloset();

    const retryButton = await screen.findByRole('button', { name: '재시도' });
    await user.click(retryButton);

    await waitFor(() => {
      expect(retryButton).toBeDisabled();
    });
    await user.click(retryButton);
    expect(retryRequestCount).toBe(1);
  });

  test('재시도 요청이 너무 잦아 거절되면 서버 문구를 토스트로 알려야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/clothing/:clothingId/retry', () =>
        HttpResponse.json(
          {
            code: 'CLOTHING_TOO_MANY_REQUESTS',
            message:
              '옷 등록 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
          },
          { status: 429 },
        ),
      ),
    );
    await renderCloset();

    await user.click(await screen.findByRole('button', { name: '재시도' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '옷 등록 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.getByText('등록 실패')).toBeInTheDocument();
  });

  test('로그인이 만료되어 재시도가 거절되면 토스트를 띄우지 않아야 한다.', async () => {
    const user = userEvent.setup();
    let retryRequestCount = 0;
    server.use(
      http.post('/api/clothing/:clothingId/retry', () => {
        retryRequestCount += 1;

        return HttpResponse.json(
          { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
          { status: 401 },
        );
      }),
    );
    await renderCloset();

    await user.click(await screen.findByRole('button', { name: '재시도' }));

    await waitFor(() => {
      expect(retryRequestCount).toBe(1);
    });
    // 응답을 받아 토스트를 띄울 기회가 지나갈 때까지 기다린다.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    expect(screen.queryByText('로그인이 필요합니다.')).not.toBeInTheDocument();
  });

  test('이미 실패 상태가 아니라 재시도가 거절되면 알리지 않고 목록을 다시 받아야 한다.', async () => {
    const user = userEvent.setup();
    let listRequestCount = 0;
    server.use(
      http.post('/api/clothing/:clothingId/retry', () =>
        HttpResponse.json(
          {
            code: 'CLOTHING_NOT_RETRYABLE',
            message: '처리에 실패한 옷만 다시 처리할 수 있습니다.',
          },
          { status: 409 },
        ),
      ),
      http.get('/api/clothing', () => {
        listRequestCount += 1;
        return undefined;
      }),
    );
    await renderCloset();

    await user.click(await screen.findByRole('button', { name: '재시도' }));

    await waitFor(() => {
      expect(listRequestCount).toBe(2);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
