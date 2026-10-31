import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import type { ClothingUpdate } from '@/generated/models';
import { server } from '@/mocks/node';
import { routeTree } from '@/routeTree.gen';

/*
 * MSW의 옷 1번은 완료된 스트라이프 반팔 티셔츠(상의·파랑·얇음·방수 아니오·캐주얼·여름)다.
 * 630번은 확인하지 않은 신규 옷, 635번은 아직 처리 중인 옷이다.
 */
const COMPLETED_ID = 1;
const NEW_ID = 630;
const PROCESSING_ID = 635;

const renderDetail = async (clothingId: number | string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({
    initialEntries: ['/closet', `/closet/${clothingId}`],
    initialIndex: 1,
  });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();
  // 옮겨 갈 화면의 코드를 미리 받아 둬야, 화면을 옮기는 테스트가 그 코드를 받는 시간에 좌우되지 않는다.
  await router.preloadRoute({ to: '/closet' });
  await router.preloadRoute({
    to: '/closet/$clothingId/edit',
    params: { clothingId: Number(clothingId) },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { history };
};

const recordPatches = () => {
  const patches: ClothingUpdate[] = [];
  server.use(
    http.patch('/api/clothing/:clothingId', async ({ request }) => {
      const body: unknown = await request.clone().json();

      if (typeof body === 'object' && body !== null) {
        patches.push(body);
      }

      return undefined;
    }),
  );

  return patches;
};

const getRow = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`^${label}`) });

describe('옷 상세 보기', () => {
  test('옷 이름과 속성 요약을 보여 주고, 값이 없는 속성은 안내 문구로 보여야 한다.', async () => {
    await renderDetail(COMPLETED_ID);

    expect(
      await screen.findByDisplayValue('스트라이프 반팔 티셔츠'),
    ).toBeInTheDocument();
    expect(getRow('분류')).toHaveTextContent('상의');
    expect(getRow('색상')).toHaveTextContent('파랑');
    expect(getRow('스타일')).toHaveTextContent('캐주얼');
    expect(getRow('계절')).toHaveTextContent('여름');
    expect(getRow('두께')).toHaveTextContent('얇음');
    expect(getRow('방수')).toHaveTextContent('아니오');
    expect(
      screen.queryByRole('button', { name: /^종류/ }),
    ).not.toBeInTheDocument();
  });

  test('확인하지 않은 옷을 열면 신규 표시를 한 번만 끄도록 알려야 한다.', async () => {
    let reviewedCount = 0;
    server.use(
      http.post('/api/clothing/:clothingId/reviewed', () => {
        reviewedCount += 1;
        return undefined;
      }),
    );
    await renderDetail(NEW_ID);
    await screen.findByDisplayValue('베이지 터틀넥');

    await waitFor(() => {
      expect(reviewedCount).toBe(1);
    });
    // 한 번 보낸 뒤 더 보내지 않는지 보려고 잠시 더 기다린다.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(reviewedCount).toBe(1);
  });

  test('없는 옷이면 옷장으로 돌려보내고 찾을 수 없다고 알려야 한다.', async () => {
    const { history } = await renderDetail(9999);

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    expect(await screen.findByText('옷을 찾을 수 없어요')).toBeInTheDocument();
  });

  test('이미지 편집기를 열었다가 닫으면 상세로 돌아와야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(screen.getByRole('button', { name: '이미지 편집' }));
    await waitFor(() => {
      expect(history.location.pathname).toBe(`/closet/${COMPLETED_ID}/edit`);
    });
    await user.click(await screen.findByRole('button', { name: '닫기' }));

    await waitFor(() => {
      expect(history.location.pathname).toBe(`/closet/${COMPLETED_ID}`);
    });
    expect(
      await screen.findByDisplayValue('스트라이프 반팔 티셔츠'),
    ).toBeInTheDocument();
  });

  test('처리가 끝나지 않은 옷이면 옷장으로 돌려보내야 한다.', async () => {
    const { history } = await renderDetail(PROCESSING_ID);

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    expect(await screen.findByText('옷을 찾을 수 없어요')).toBeInTheDocument();
  });
});

describe('상세에서 옷 삭제', () => {
  test('[이 옷 삭제]에서 확인하면 기록을 바꿔치기하며 옷장으로 돌아가고 삭제했다고 알려야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(screen.getByRole('button', { name: '이 옷 삭제' }));
    const dialog = await screen.findByRole('dialog', {
      name: '이 옷을 삭제할까요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    expect(await screen.findByText('옷을 삭제했어요')).toBeInTheDocument();
    // 지운 옷의 상세 기록이 옷장으로 바뀌어, 뒤로 가도 지운 상세로 돌아가지 않는다.
    act(() => {
      history.back();
    });
    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    expect(history.canGoBack()).toBe(false);
  });

  test('저장을 기다리던 속성이 옷을 지운 뒤 실패해도 저장하지 못했다고 알리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/clothing/:clothingId', async () => {
        await delay(300);
        return HttpResponse.json(
          { code: 'CLOTHING_NOT_FOUND', message: '옷을 찾을 수 없습니다.' },
          { status: 404 },
        );
      }),
    );
    const { history } = await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('색상'));
    await user.click(screen.getByRole('button', { name: '검정' }));
    await user.click(screen.getByRole('button', { name: '이 옷 삭제' }));
    const dialog = await screen.findByRole('dialog', {
      name: '이 옷을 삭제할까요?',
    });
    await user.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    expect(await screen.findByText('옷을 삭제했어요')).toBeInTheDocument();
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(
      screen.queryByText('색상을 저장하지 못했어요'),
    ).not.toBeInTheDocument();
  });
});

describe('옷 속성 바로 저장', () => {
  test('칩을 누르면 그 속성만 저장하고 요약을 바로 바꿔야 한다.', async () => {
    const user = userEvent.setup();
    const patches = recordPatches();
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('색상'));
    await user.click(screen.getByRole('button', { name: '검정' }));

    expect(getRow('색상')).toHaveTextContent('검정');
    await waitFor(() => {
      expect(patches).toEqual([{ color_cd: 'black' }]);
    });
  });

  test('버건디와 보라를 고르면 서버 색상 코드로 저장해야 한다.', async () => {
    const user = userEvent.setup();
    const patches = recordPatches();
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('색상'));
    await user.click(screen.getByRole('button', { name: '버건디' }));
    await user.click(screen.getByRole('button', { name: '보라' }));

    expect(getRow('색상')).toHaveTextContent('보라');
    await waitFor(() => {
      expect(patches).toEqual([
        { color_cd: 'burgundy' },
        { color_cd: 'purple' },
      ]);
    });
  });

  test('여러 개를 고르는 속성은 고른 값 전체를 칩 순서대로 저장해야 한다.', async () => {
    const user = userEvent.setup();
    const patches = recordPatches();
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('계절'));
    await user.click(screen.getByRole('button', { name: '봄' }));

    expect(getRow('계절')).toHaveTextContent('봄, 여름');
    await waitFor(() => {
      expect(patches).toEqual([{ season_cds: ['spring', 'summer'] }]);
    });
  });

  test('선택된 칩을 다시 누르면 그 값을 비워 저장해야 한다.', async () => {
    const user = userEvent.setup();
    const patches = recordPatches();
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('두께'));
    await user.click(screen.getByRole('button', { name: '얇음' }));

    expect(getRow('두께')).toHaveTextContent('두께를 선택해 주세요');
    await waitFor(() => {
      expect(patches).toEqual([{ thickness_cd: null }]);
    });
  });

  test('빠르게 여러 번 바꿔도 요청을 차례로 보내 마지막 값이 남아야 한다.', async () => {
    const user = userEvent.setup();
    const patches: ClothingUpdate[] = [];
    let isFirstAnswered = false;
    let wasFirstAnsweredOnSecond: boolean | null = null;
    server.use(
      http.patch('/api/clothing/:clothingId', async ({ request }) => {
        const body: unknown = await request.clone().json();

        if (typeof body === 'object' && body !== null) {
          patches.push(body);
        }

        // 앞 요청이 늦게 끝나도 뒤 요청은 앞 요청의 응답을 받은 뒤에 나가야 한다.
        if (patches.length === 1) {
          await delay(200);
          isFirstAnswered = true;
        } else {
          wasFirstAnsweredOnSecond = isFirstAnswered;
        }

        return undefined;
      }),
    );
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('색상'));
    await user.click(screen.getByRole('button', { name: '검정' }));
    await user.click(screen.getByRole('button', { name: '흰색' }));

    await waitFor(() => {
      expect(patches).toEqual([{ color_cd: 'black' }, { color_cd: 'white' }]);
    });
    expect(wasFirstAnsweredOnSecond).toBe(true);
    expect(getRow('색상')).toHaveTextContent('흰색');
  });

  test('분류 저장이 실패해 악세서리가 아니게 되면, 기다리던 종류 저장은 보내지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const patches: ClothingUpdate[] = [];
    // 종류를 고를 때까지 분류 저장의 응답을 붙잡아 둔다.
    let answerCategory = () => {};
    const categoryAnswered = new Promise<void>((resolve) => {
      answerCategory = resolve;
    });
    server.use(
      http.patch('/api/clothing/:clothingId', async ({ request }) => {
        const body: unknown = await request.clone().json();

        if (typeof body === 'object' && body !== null) {
          patches.push(body);
        }

        await categoryAnswered;
        return HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        );
      }),
    );
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('분류'));
    await user.click(screen.getByRole('button', { name: '악세서리' }));
    await user.click(getRow('종류'));
    await user.click(screen.getByRole('button', { name: '가방' }));
    answerCategory();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '처리 중 오류가 발생했습니다.',
    );
    expect(getRow('분류')).toHaveTextContent('상의');
    expect(
      screen.queryByRole('button', { name: /^종류/ }),
    ).not.toBeInTheDocument();
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(patches).toEqual([{ category_cd: 'accessories' }]);
  });

  test('저장하지 못하면 그 속성만 이전 값으로 돌리고 행 아래에 서버 문구를 보여야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/clothing/:clothingId', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('색상'));
    await user.click(screen.getByRole('button', { name: '검정' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '처리 중 오류가 발생했습니다.',
    );
    expect(getRow('색상')).toHaveTextContent('파랑');
  });

  test('분류를 악세서리로 바꾸면 종류 행이 생기고, 다른 분류로 바꾸면 사라져야 한다.', async () => {
    const user = userEvent.setup();
    await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('분류'));
    await user.click(screen.getByRole('button', { name: '악세서리' }));

    expect(getRow('종류')).toHaveTextContent('종류를 선택해 주세요');

    await user.click(screen.getByRole('button', { name: '하의' }));

    expect(
      screen.queryByRole('button', { name: /^종류/ }),
    ).not.toBeInTheDocument();
  });

  test('이름은 입력칸을 벗어날 때 저장하고, 비우면 비운 값으로 저장해야 한다.', async () => {
    const user = userEvent.setup();
    const patches = recordPatches();
    await renderDetail(COMPLETED_ID);
    const nameField = await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.clear(nameField);
    await user.type(nameField, '  여름   티셔츠 ');
    await user.tab();

    await waitFor(() => {
      expect(patches).toEqual([{ item_name: '여름 티셔츠' }]);
    });
    expect(nameField).toHaveValue('여름 티셔츠');

    await user.clear(nameField);
    await user.tab();

    await waitFor(() => {
      expect(patches).toEqual([
        { item_name: '여름 티셔츠' },
        { item_name: null },
      ]);
    });
  });

  test('지우기 버튼으로 비우고 다시 입력하면 입력칸을 벗어날 때 마지막 이름만 저장해야 한다.', async () => {
    const user = userEvent.setup();
    const patches = recordPatches();
    await renderDetail(COMPLETED_ID);
    const nameField = await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(nameField);
    await user.click(screen.getByRole('button', { name: '입력 지우기' }));
    await user.type(nameField, '반팔');

    expect(patches).toEqual([]);

    await user.tab();

    await waitFor(() => {
      expect(patches).toEqual([{ item_name: '반팔' }]);
    });
  });

  test('저장 응답이 오기 전에 상세를 떠났다가 실패하면 토스트로 알려야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/clothing/:clothingId', async () => {
        await delay(300);
        return HttpResponse.json(
          { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' },
          { status: 500 },
        );
      }),
    );
    const { history } = await renderDetail(COMPLETED_ID);
    await screen.findByDisplayValue('스트라이프 반팔 티셔츠');

    await user.click(getRow('색상'));
    await user.click(screen.getByRole('button', { name: '검정' }));
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => {
      expect(history.location.pathname).toBe('/closet');
    });
    const toast = await screen.findByRole('alert');
    expect(
      within(toast).getByText('색상을 저장하지 못했어요'),
    ).toBeInTheDocument();
  });
});
