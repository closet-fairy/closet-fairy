import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getListClothingClothingGetInfiniteQueryKey } from '@/generated/endpoints/clothing/clothing';
import type { ClothingPage } from '@/generated/models';
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
