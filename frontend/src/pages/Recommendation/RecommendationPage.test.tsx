import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as TanStackRouter from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  ClothingShortagePrecheckResponse,
  WeatherPreview,
} from '@/generated/models';
import {
  PENDING_RECOMMENDATION_STORAGE_KEY,
  RECOMMENDATION_FORM_DRAFT_STORAGE_KEY,
} from '@/constants/recommendationStorageKey';
import { server } from '@/mocks/node';
import RecommendationPage from './RecommendationPage';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof TanStackRouter>()),
  useNavigate: () => navigate,
}));

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RecommendationPage />
    </QueryClientProvider>,
  );

const submitButton = () =>
  screen.getByRole('button', { name: '코디 추천 받기' });

const chooseLocationBySearch = async (
  user: ReturnType<typeof userEvent.setup>,
) => {
  await user.click(
    screen.getByRole('button', { name: '위치 위치를 선택하세요' }),
  );
  await user.click(
    await screen.findByRole('button', { name: /주소 직접 입력/ }),
  );
  await user.type(
    await screen.findByRole('searchbox', { name: '지역 검색' }),
    '성동',
  );
  await user.click(
    await screen.findByRole('button', { name: '서울특별시 성동구' }),
  );
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
};

const pickGoingOutTime = async (
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  time: string,
  day?: string,
) => {
  await user.click(trigger);

  if (day !== undefined) {
    await user.click(
      within(await screen.findByRole('listbox', { name: '날짜' })).getByRole(
        'option',
        { name: day },
      ),
    );
  }

  await user.click(
    within(await screen.findByRole('listbox', { name: '시각' })).getByRole(
      'option',
      { name: time },
    ),
  );
  await user.click(screen.getByRole('button', { name: /선택$/ }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T09:10:00+09:00'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  navigate.mockReset();
  sessionStorage.clear();
});

describe('기본 외출 시간 갱신', () => {
  const startTrigger = (time: string) =>
    screen.getByRole('button', { name: `외출 시간 나가는 시간 ${time}` });

  test('화면을 연 채 다음 슬롯이 되면 손대지 않은 나가는 시간이 현재 슬롯으로 바뀌어야 한다.', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-14T09:10:00+09:00'));
    renderPage();

    expect(startTrigger('09:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    expect(startTrigger('09:30')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(startTrigger('10:00')).toBeInTheDocument();
  });

  test('화면이 다시 보이면 손대지 않은 나가는 시간이 현재 슬롯으로 바뀌어야 한다.', () => {
    renderPage();

    vi.setSystemTime(new Date('2026-10-14T09:40:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(startTrigger('09:30')).toBeInTheDocument();
  });

  test('직접 고른 나가는 시간은 슬롯이 바뀌어도 그대로 남아야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await pickGoingOutTime(user, startTrigger('09:00'), '12:00');
    vi.setSystemTime(new Date('2026-10-14T09:40:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(startTrigger('12:00')).toBeInTheDocument();
  });

  test('나가는 시간만 고르면 돌아오는 시간은 고른 시간의 5시간 뒤가 되고, 슬롯이 바뀌어도 그대로여야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await pickGoingOutTime(user, startTrigger('09:00'), '14:30');

    expect(
      screen.getByRole('button', { name: '외출 시간 돌아오는 시간 19:30' }),
    ).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-10-14T09:40:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(
      screen.getByRole('button', { name: '외출 시간 돌아오는 시간 19:30' }),
    ).toBeInTheDocument();
  });
});

describe('추천 요청 보내기', () => {
  test('고른 상황과 외출 시간을 담아 추천 요청을 보내야 한다.', async () => {
    const user = userEvent.setup();
    let receivedBody: unknown;
    server.use(
      http.post('/api/recommendation-sessions', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          { recommendation_session_id: 7, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await user.click(screen.getByRole('button', { name: '출근' }));
    await user.click(submitButton());

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: '/recommendation/sessions/$sessionId',
        params: { sessionId: 7 },
      });
    });
    expect(receivedBody).toEqual({
      sido_nm: '서울특별시',
      sigungu_nm: '성동구',
      location_input_type_cd: 'manual',
      tpo_cd: 'work',
      going_out_start_time: '09:00',
      going_out_end_time: '14:00',
      going_out_date_cd: 'today',
    });
    expect(
      JSON.parse(
        sessionStorage.getItem(PENDING_RECOMMENDATION_STORAGE_KEY) ?? 'null',
      ),
    ).toMatchObject({
      sessionId: 7,
      request: receivedBody,
      form: {
        location: {
          sidoNm: '서울특별시',
          sigunguNm: '성동구',
          inputTypeCd: 'manual',
        },
        tpo: { cd: 'work' },
        customTpoText: null,
        start: null,
        end: null,
      },
    });
  });

  test('요청 중에는 버튼이 비활성화되어 다시 눌러도 요청이 한 번만 나가야 한다.', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    let releaseResponse = () => {};
    server.use(
      http.post('/api/recommendation-sessions', async () => {
        requestCount += 1;
        await new Promise<void>((resolve) => {
          releaseResponse = resolve;
        });
        return HttpResponse.json(
          { recommendation_session_id: 8, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await user.click(submitButton());
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    await user.click(submitButton());

    expect(requestCount).toBe(1);
    releaseResponse();
    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });
  });

  test('요청 중에 상황을 바꿔도 버튼은 비활성 상태를 유지해 요청이 한 번만 나가야 한다.', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    let releaseResponse = () => {};
    server.use(
      http.post('/api/recommendation-sessions', async () => {
        requestCount += 1;
        await new Promise<void>((resolve) => {
          releaseResponse = resolve;
        });
        return HttpResponse.json(
          { recommendation_session_id: 10, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await user.click(submitButton());
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: '운동' }));
    await user.click(submitButton());

    expect(submitButton()).toBeDisabled();
    expect(requestCount).toBe(1);
    releaseResponse();
    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });
  });
});

describe('오류 안내', () => {
  test('서버가 요청을 거절하면 서버가 준 안내 문구를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/recommendation-sessions', () =>
        HttpResponse.json(
          {
            code: 'PAST_GOING_OUT_TIME',
            message: '외출 시작 시각이 이미 지났습니다.',
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '외출 시작 시각이 이미 지났습니다.',
      );
    });
  });

  test('나가는 시간과 돌아오는 시간이 같으면 요청을 보내지 않고 안내 문구를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.post('/api/recommendation-sessions', () => {
        requestCount += 1;
        return HttpResponse.json(
          { recommendation_session_id: 9, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await pickGoingOutTime(
      user,
      screen.getByRole('button', { name: '외출 시간 돌아오는 시간 14:00' }),
      '15:00',
    );
    await pickGoingOutTime(
      user,
      screen.getByRole('button', { name: '외출 시간 나가는 시간 09:00' }),
      '15:00',
    );
    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '외출 시작과 종료 시각이 같습니다.',
      );
    });
    expect(requestCount).toBe(0);
  });

  test('안내 문구가 뜬 뒤 입력을 고치면 안내 문구가 사라져야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/recommendation-sessions', () =>
        HttpResponse.json(
          {
            code: 'PAST_GOING_OUT_TIME',
            message: '외출 시작 시각이 이미 지났습니다.',
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await user.click(submitButton());
    await waitFor(() => {
      expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
    });
    await user.click(screen.getByRole('button', { name: '운동' }));

    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  test('로그인이 만료돼 401을 받으면 화면에 따로 안내하지 않아야 한다.', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.post('/api/recommendation-sessions', () => {
        requestCount += 1;

        return HttpResponse.json(
          { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' },
          { status: 401 },
        );
      }),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await user.click(submitButton());
    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });

    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });
});

describe('상황 직접 입력', () => {
  const customChip = (name: string) => screen.getByRole('button', { name });

  const setCustomTpo = async (
    user: ReturnType<typeof userEvent.setup>,
    chipName: string,
    text: string,
  ) => {
    await user.click(customChip(chipName));
    const input = await screen.findByRole('textbox', { name: '상황' });
    await user.clear(input);
    await user.type(input, text);
    await user.click(screen.getByRole('button', { name: '이 상황으로 설정' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  };

  test('직접 입력한 문구를 설정하면 칩이 그 문구로 바뀌어 선택되고, 추천 요청에 custom과 문구를 담아야 한다.', async () => {
    const user = userEvent.setup();
    let receivedBody: unknown;
    server.use(
      http.post('/api/recommendation-sessions', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          { recommendation_session_id: 13, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();
    await chooseLocationBySearch(user);
    await setCustomTpo(user, '직접 입력', '학교 발표');

    expect(customChip('학교 발표')).toHaveAttribute('aria-pressed', 'true');

    await user.click(submitButton());

    await waitFor(() => {
      expect(receivedBody).toMatchObject({
        tpo_cd: 'custom',
        tpo_text: '학교 발표',
      });
    });
  });

  test('다른 칩을 골랐다가 문구 칩을 다시 누르면 시트 없이 그 문구가 다시 선택되어야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await setCustomTpo(user, '직접 입력', '학교 발표');
    await user.click(screen.getByRole('button', { name: '출근' }));

    expect(customChip('학교 발표')).toHaveAttribute('aria-pressed', 'false');

    await user.click(customChip('학교 발표'));

    expect(customChip('학교 발표')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('이미 선택된 문구 칩을 누르면 적어 둔 문구가 채워진 시트가 열려 고칠 수 있어야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await setCustomTpo(user, '직접 입력', '학교 발표');
    await user.click(customChip('학교 발표'));

    expect(await screen.findByRole('textbox', { name: '상황' })).toHaveValue(
      '학교 발표',
    );

    const input = screen.getByRole('textbox', { name: '상황' });
    await user.clear(input);
    await user.type(input, '동아리 발표');
    await user.click(screen.getByRole('button', { name: '이 상황으로 설정' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(customChip('동아리 발표')).toHaveAttribute('aria-pressed', 'true');
  });

  test('문구가 비어 있거나 공백뿐이면 설정 버튼이 비활성이어야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(customChip('직접 입력'));
    const input = await screen.findByRole('textbox', { name: '상황' });

    expect(
      screen.getByRole('button', { name: '이 상황으로 설정' }),
    ).toBeDisabled();

    await user.type(input, '   ');

    expect(
      screen.getByRole('button', { name: '이 상황으로 설정' }),
    ).toBeDisabled();
  });

  test('설정하지 않고 시트를 닫으면 고치던 문구는 버리고 원래 문구와 선택을 유지해야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await setCustomTpo(user, '직접 입력', '학교 발표');
    await user.click(customChip('학교 발표'));
    const input = await screen.findByRole('textbox', { name: '상황' });
    await user.type(input, ' 리허설');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(customChip('학교 발표')).toHaveAttribute('aria-pressed', 'true');

    await user.click(customChip('학교 발표'));

    expect(await screen.findByRole('textbox', { name: '상황' })).toHaveValue(
      '학교 발표',
    );
  });

  test('처음 연 직접 입력 시트를 설정하지 않고 닫으면 원래 고른 칩과 "직접 입력" 칩을 그대로 두어야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(customChip('직접 입력'));
    await screen.findByRole('textbox', { name: '상황' });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '데일리' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(customChip('직접 입력')).toHaveAttribute('aria-pressed', 'false');
  });

  test('Enter를 누르면 문구를 설정하고, 문구가 비어 있으면 아무 일도 일어나지 않아야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(customChip('직접 입력'));
    const input = await screen.findByRole('textbox', { name: '상황' });
    await user.keyboard('{Enter}');

    expect(
      screen.getByRole('dialog', { name: '어떤 상황인가요' }),
    ).toBeInTheDocument();

    await user.type(input, '학교 발표{Enter}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(customChip('학교 발표')).toHaveAttribute('aria-pressed', 'true');
  });

  test('문구가 최대 글자 수를 넘으면 설정 버튼이 비활성이어야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(customChip('직접 입력'));
    const input = await screen.findByRole('textbox', { name: '상황' });
    await user.click(input);
    await user.paste('가'.repeat(101));

    expect(
      screen.getByRole('button', { name: '이 상황으로 설정' }),
    ).toBeDisabled();
  });

  test('서버가 직접 입력한 문구를 거절하면 서버가 준 안내 문구를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/recommendation-sessions', () =>
        HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message: '입력할 수 없는 내용이 포함되어 있습니다.',
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();
    await chooseLocationBySearch(user);
    await setCustomTpo(user, '직접 입력', '학교 발표');
    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '입력할 수 없는 내용이 포함되어 있습니다.',
      );
    });
  });
});

describe('외출 날짜', () => {
  const startTrigger = (label: string) =>
    screen.getByRole('button', { name: `외출 시간 나가는 시간 ${label}` });
  const endTrigger = (label: string) =>
    screen.getByRole('button', { name: `외출 시간 돌아오는 시간 ${label}` });

  const optionLabels = (listboxName: string) =>
    within(screen.getByRole('listbox', { name: listboxName }))
      .getAllByRole('option')
      .map((option) => option.textContent);

  test('나가는 시간 시트는 날짜 휠에 오늘과 내일을 두고, 오늘이면 지금 시각부터, 내일이면 모든 시각을 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(startTrigger('09:00'));
    await screen.findByRole('dialog');

    expect(optionLabels('날짜')).toEqual(['오늘', '내일']);
    expect(optionLabels('시각').at(0)).toBe('09:00');
    expect(optionLabels('시각').at(-1)).toBe('23:30');

    await user.click(screen.getByRole('option', { name: '내일' }));

    expect(optionLabels('시각')).toHaveLength(48);
    expect(optionLabels('시각').at(0)).toBe('00:00');
  });

  test('돌아오는 시간 시트는 설명에 나가는 시간을 보여 주고, 나간 뒤 30분부터 23시간 30분까지만 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await pickGoingOutTime(user, startTrigger('09:00'), '21:00');
    await user.click(endTrigger('내일 02:00'));
    const dialog = await screen.findByRole('dialog');

    expect(dialog).toHaveAccessibleDescription('나가는 시간 오늘 21:00');
    expect(optionLabels('날짜')).toEqual(['오늘', '내일']);
    expect(screen.getByRole('option', { name: '내일' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(optionLabels('시각').at(0)).toBe('00:00');
    expect(optionLabels('시각').at(-1)).toBe('20:30');

    await user.click(screen.getByRole('option', { name: '오늘' }));

    expect(optionLabels('시각')).toEqual([
      '21:30',
      '22:00',
      '22:30',
      '23:00',
      '23:30',
    ]);
  });

  test('날짜를 바꿔 고른 시각이 범위를 벗어나면 범위의 가까운 끝으로 맞춰야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(startTrigger('09:00'));
    await user.click(await screen.findByRole('option', { name: '내일' }));
    await user.click(screen.getByRole('option', { name: '08:00' }));

    expect(
      screen.getByRole('button', { name: '내일 08:00 선택' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '오늘' }));

    expect(
      screen.getByRole('button', { name: '오늘 09:00 선택' }),
    ).toBeInTheDocument();
  });

  test('시각 휠의 끝에서 더 내려도 날짜는 바뀌지 않아야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(startTrigger('09:00'));
    screen.getByRole('listbox', { name: '시각' }).focus();
    await user.keyboard('{End}{ArrowDown}');

    expect(
      screen.getByRole('button', { name: '오늘 23:30 선택' }),
    ).toBeInTheDocument();
  });

  test('선택 버튼을 누르지 않고 시트를 닫으면 휠에서 바꾼 값을 버려야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(startTrigger('09:00'));
    await user.click(await screen.findByRole('option', { name: '12:00' }));
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(startTrigger('09:00')).toBeInTheDocument();

    await user.click(startTrigger('09:00'));

    expect(
      await screen.findByRole('button', { name: '오늘 09:00 선택' }),
    ).toBeInTheDocument();
  });

  test('내일 시각을 고르면 지금보다 이른 시각이어도 tomorrow로 추천을 요청해야 한다.', async () => {
    const user = userEvent.setup();
    let receivedBody: unknown;
    server.use(
      http.post('/api/recommendation-sessions', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          { recommendation_session_id: 21, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();
    await chooseLocationBySearch(user);

    await pickGoingOutTime(user, startTrigger('09:00'), '08:00', '내일');

    expect(endTrigger('내일 13:00')).toBeInTheDocument();

    await user.click(submitButton());

    await waitFor(() => {
      expect(receivedBody).toMatchObject({
        going_out_date_cd: 'tomorrow',
        going_out_start_time: '08:00',
        going_out_end_time: '13:00',
      });
    });
  });

  test('돌아오는 시각은 오늘을 기준으로 내일과 모레를 붙여 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await pickGoingOutTime(user, startTrigger('09:00'), '22:00');

    expect(endTrigger('내일 03:00')).toBeInTheDocument();

    await pickGoingOutTime(user, startTrigger('22:00'), '22:00', '내일');

    expect(endTrigger('모레 03:00')).toBeInTheDocument();
  });

  test('화면을 연 채 자정이 지나면 고른 내일 시각이 오늘 시각이 되어 today로 요청해야 한다.', async () => {
    const user = userEvent.setup();
    let receivedBody: unknown;
    server.use(
      http.post('/api/recommendation-sessions', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          { recommendation_session_id: 22, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    vi.setSystemTime(new Date('2026-10-14T23:40:00+09:00'));
    renderPage();
    await chooseLocationBySearch(user);

    await pickGoingOutTime(user, startTrigger('23:30'), '09:00', '내일');
    vi.setSystemTime(new Date('2026-10-15T00:10:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(startTrigger('09:00')).toBeInTheDocument();

    await user.click(submitButton());

    await waitFor(() => {
      expect(receivedBody).toMatchObject({
        going_out_date_cd: 'today',
        going_out_start_time: '09:00',
      });
    });
  });

  test('자정이 지나 내일 외출이 오늘이 되면 돌아오는 시각에서도 내일 표시가 빠져야 한다.', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-10-14T23:40:00+09:00'));
    renderPage();

    await pickGoingOutTime(user, startTrigger('23:30'), '09:00', '내일');

    expect(endTrigger('내일 14:00')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-10-15T00:10:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(endTrigger('14:00')).toBeInTheDocument();
  });

  test('고른 오늘 시각이 자정을 넘겨 어제가 되면 어제로 표시하고, 요청하면 지난 시각이라고 알려야 한다.', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.post('/api/recommendation-sessions', () => {
        requestCount += 1;
        return HttpResponse.json(
          { recommendation_session_id: 23, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    vi.setSystemTime(new Date('2026-10-14T23:20:00+09:00'));
    renderPage();
    await chooseLocationBySearch(user);

    await pickGoingOutTime(user, startTrigger('23:00'), '23:30');
    vi.setSystemTime(new Date('2026-10-15T00:10:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(startTrigger('어제 23:30')).toBeInTheDocument();

    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '외출 시작 시각이 이미 지났습니다.',
      );
    });
    expect(requestCount).toBe(0);
  });

  test('고른 오늘 시각이 지나간 뒤 요청하면 지난 시각이라고 알려야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();
    await chooseLocationBySearch(user);

    await pickGoingOutTime(user, startTrigger('09:00'), '09:30');
    vi.setSystemTime(new Date('2026-10-14T10:10:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '외출 시작 시각이 이미 지났습니다.',
      );
    });
  });

  test('고른 시각이 이틀 이상 지나면 날짜를 붙여 보여 주고, 요청하면 지난 시각이라고 알려야 한다.', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-10-14T22:00:00+09:00'));
    renderPage();
    await chooseLocationBySearch(user);

    await pickGoingOutTime(user, startTrigger('22:00'), '23:30');
    vi.setSystemTime(new Date('2026-10-16T10:00:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(startTrigger('10/14 23:30')).toBeInTheDocument();
    expect(endTrigger('어제 04:30')).toBeInTheDocument();

    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '외출 시작 시각이 이미 지났습니다.',
      );
    });
  });
});

describe('위치 고르기', () => {
  const stubGeolocation = (
    getCurrentPosition: (
      onSuccess: PositionCallback,
      onError: PositionErrorCallback,
    ) => void,
  ) => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
  };

  const createPosition = (
    latitude: number,
    longitude: number,
  ): GeolocationPosition => ({
    coords: {
      latitude,
      longitude,
      accuracy: 100,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  });

  const createPositionError = (code: number): GeolocationPositionError => ({
    code,
    message: '',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  });

  const openSheetAndUseCurrentLocation = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    await user.click(
      screen.getByRole('button', { name: '위치 위치를 선택하세요' }),
    );
    await user.click(
      await screen.findByRole('button', { name: /현재 위치 사용/ }),
    );
  };

  const UNAVAILABLE_NOTICE =
    '현재 위치를 확인하지 못했어요. 주소를 직접 입력해 주세요.';

  const weatherPreview = (
    overrides: Partial<WeatherPreview> = {},
  ): WeatherPreview => ({
    temperature: 24.3,
    feels_like_temperature: 25.1,
    weather_condition_cd: 'overcast',
    is_fallback: false,
    is_sky_missing: false,
    ...overrides,
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  test('위치를 고르지 않고 추천을 요청하면 요청을 보내지 않고 위치를 고르라는 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.post('/api/recommendation-sessions', () => {
        requestCount += 1;
        return HttpResponse.json(
          { recommendation_session_id: 11, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();

    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '위치를 선택해 주세요.',
      );
    });
    expect(requestCount).toBe(0);

    await chooseLocationBySearch(user);

    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  test('날씨를 불러오지 못하면 날씨를 확인할 수 없다고 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/weather/preview', () =>
        HttpResponse.json(
          { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류입니다.' },
          { status: 500 },
        ),
      ),
    );
    renderPage();

    await chooseLocationBySearch(user);

    expect(
      await screen.findByRole('button', {
        name: '위치 서울 성동구 날씨 확인 불가',
      }),
    ).toBeInTheDocument();
  });

  test('주소를 검색해 고르면 위치 필드에 짧은 이름과 그 지역의 날씨를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    let weatherParams: URLSearchParams | undefined;
    server.use(
      http.get('/api/weather/preview', ({ request }) => {
        weatherParams = new URL(request.url).searchParams;
        return HttpResponse.json(weatherPreview());
      }),
    );
    renderPage();

    await chooseLocationBySearch(user);

    expect(
      await screen.findByRole('button', { name: '위치 서울 성동구 24° 흐림' }),
    ).toBeInTheDocument();
    expect(weatherParams?.get('sido_nm')).toBe('서울특별시');
    expect(weatherParams?.get('sigungu_nm')).toBe('성동구');
  });

  test('날씨가 대체값이면 기온 대신 날씨를 확인할 수 없다고 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/weather/preview', () =>
        HttpResponse.json(
          weatherPreview({
            temperature: 13.2,
            weather_condition_cd: 'clear',
            is_fallback: true,
          }),
        ),
      ),
    );
    renderPage();

    await chooseLocationBySearch(user);

    expect(
      await screen.findByRole('button', {
        name: '위치 서울 성동구 날씨 확인 불가',
      }),
    ).toBeInTheDocument();
  });

  test('현재 위치를 쓰면 좌표를 본문으로 보내 찾은 지역을 고르고, 추천 요청에 current로 담아야 한다.', async () => {
    const user = userEvent.setup();
    let nearestBody: unknown;
    let sessionBody: unknown;
    stubGeolocation((onSuccess) => {
      onSuccess(createPosition(37.5634, 127.0369));
    });
    server.use(
      http.post('/api/regions/nearest', async ({ request }) => {
        nearestBody = await request.json();
        return HttpResponse.json({
          sido_nm: '서울특별시',
          sigungu_nm: '성동구',
        });
      }),
      http.post('/api/recommendation-sessions', async ({ request }) => {
        sessionBody = await request.json();
        return HttpResponse.json(
          { recommendation_session_id: 12, session_status_cd: 'active' },
          { status: 202 },
        );
      }),
    );
    renderPage();

    await openSheetAndUseCurrentLocation(user);
    await screen.findByRole('button', { name: /^위치 서울 성동구/ });
    await user.click(submitButton());

    expect(nearestBody).toEqual({ lat: 37.5634, lon: 127.0369 });
    await waitFor(() => {
      expect(sessionBody).toMatchObject({
        sido_nm: '서울특별시',
        sigungu_nm: '성동구',
        location_input_type_cd: 'current',
      });
    });
  });

  test('위치 권한을 거부하면 주소 직접 입력 화면으로 넘어가 권한이 없다고 알려야 한다.', async () => {
    const user = userEvent.setup();
    stubGeolocation((_onSuccess, onError) => {
      onError(createPositionError(1));
    });
    renderPage();

    await openSheetAndUseCurrentLocation(user);

    expect(
      await screen.findByRole('dialog', { name: '주소 입력' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: '지역 검색' }),
    ).toHaveAccessibleDescription(
      '위치 권한이 없어 현재 위치를 쓸 수 없어요. 주소를 직접 입력해 주세요.',
    );
  });

  test('현재 위치 근처에 지역이 없으면 주소 직접 입력 화면으로 넘어가 그 사실을 알려야 한다.', async () => {
    const user = userEvent.setup();
    stubGeolocation((onSuccess) => {
      onSuccess(createPosition(35.6812, 139.7671));
    });
    server.use(
      http.post('/api/regions/nearest', () =>
        HttpResponse.json(
          { code: 'REGION_NOT_FOUND', message: '지원하지 않는 지역입니다.' },
          { status: 404 },
        ),
      ),
    );
    renderPage();

    await openSheetAndUseCurrentLocation(user);

    expect(
      await screen.findByRole('dialog', { name: '주소 입력' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: '지역 검색' }),
    ).toHaveAccessibleDescription(
      '현재 위치 근처에서 지역을 찾지 못했어요. 주소를 직접 입력해 주세요.',
    );
  });

  test('현재 위치를 찾는 동안에는 화면 낭독기에 찾는 중이라고 알리고 주소 직접 입력을 잠가야 한다.', async () => {
    const user = userEvent.setup();
    stubGeolocation(() => {});
    renderPage();

    await openSheetAndUseCurrentLocation(user);

    expect(
      screen
        .getAllByRole('status')
        .some((status) =>
          status.textContent?.includes('현재 위치를 찾는 중이에요'),
        ),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: /주소 직접 입력/ }),
    ).toBeDisabled();
  });

  test('위치 확인 시간이 지나면 주소 직접 입력 화면으로 넘어가 현재 위치를 확인하지 못했다고 알려야 한다.', async () => {
    const user = userEvent.setup();
    stubGeolocation((_onSuccess, onError) => {
      onError(createPositionError(3));
    });
    renderPage();

    await openSheetAndUseCurrentLocation(user);

    expect(
      await screen.findByRole('searchbox', { name: '지역 검색' }),
    ).toHaveAccessibleDescription(UNAVAILABLE_NOTICE);
  });

  test('지역 찾기 요청이 서버 오류로 실패하면 주소 직접 입력 화면으로 넘어가 현재 위치를 확인하지 못했다고 알려야 한다.', async () => {
    const user = userEvent.setup();
    stubGeolocation((onSuccess) => {
      onSuccess(createPosition(37.5634, 127.0369));
    });
    server.use(
      http.post('/api/regions/nearest', () =>
        HttpResponse.json(
          { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류입니다.' },
          { status: 500 },
        ),
      ),
    );
    renderPage();

    await openSheetAndUseCurrentLocation(user);

    expect(
      await screen.findByRole('searchbox', { name: '지역 검색' }),
    ).toHaveAccessibleDescription(UNAVAILABLE_NOTICE);
  });

  test('위치를 찾는 중에 시트를 닫으면 늦게 찾은 위치로 바꾸지 않아야 한다.', async () => {
    const user = userEvent.setup();
    let resolvePosition = () => {};
    stubGeolocation((onSuccess) => {
      resolvePosition = () => {
        onSuccess(createPosition(37.5634, 127.0369));
      };
    });
    let nearestRequestCount = 0;
    server.use(
      http.post('/api/regions/nearest', () => {
        nearestRequestCount += 1;
        return HttpResponse.json({
          sido_nm: '서울특별시',
          sigungu_nm: '성동구',
        });
      }),
    );
    renderPage();

    await openSheetAndUseCurrentLocation(user);
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    act(() => {
      resolvePosition();
    });
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    });

    expect(nearestRequestCount).toBe(0);
    expect(
      screen.getByRole('button', { name: '위치 위치를 선택하세요' }),
    ).toBeInTheDocument();
  });

  test('위치를 찾는 중에 시트를 닫은 뒤 위치 확인이 실패해도, 시트를 다시 열 때 주소 직접 입력 화면이 저절로 열리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    let rejectPosition = () => {};
    stubGeolocation((_onSuccess, onError) => {
      rejectPosition = () => {
        onError(createPositionError(1));
      };
    });
    renderPage();

    await openSheetAndUseCurrentLocation(user);
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    act(() => {
      rejectPosition();
    });
    await user.click(
      screen.getByRole('button', { name: '위치 위치를 선택하세요' }),
    );

    expect(
      await screen.findByRole('dialog', { name: '위치 설정' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: '주소 입력' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /현재 위치 사용/ }),
    ).toHaveAccessibleName(/위치 권한을 한 번 확인합니다/);
  });
});

describe('옷 부족 안내', () => {
  const respondPrecheck = (precheck: ClothingShortagePrecheckResponse) => {
    server.use(
      http.get('/api/recommendations/precheck', () =>
        HttpResponse.json(precheck),
      ),
    );
  };

  test('2벌 미만인 카테고리가 있으면 그 카테고리를 담아 안내하고, 옷 등록하기를 누르면 옷장으로 이동해야 한다.', async () => {
    const user = userEvent.setup();
    respondPrecheck({
      is_clothing_shortage: true,
      category_counts: { top: 3, bottom: 1, shoes: 0 },
      shortage_categories: ['bottom', 'shoes'],
      notice_cd: 'clothing_shortage',
    });
    renderPage();

    const title = '하의·신발이 각각 2개보다 적어 추천이 단조로울 수 있어요';

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(title);
    });
    expect(screen.getAllByText(title)).toHaveLength(2);
    expect(
      screen.getByText('모자란 옷은 기본 아이템으로 채워 추천합니다.'),
    ).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '옷 등록하기' }));

    expect(navigate).toHaveBeenCalledWith({ to: '/closet' });
  });

  test('옷이 부족하지 않으면 안내를 띄우지 않아야 한다.', async () => {
    let precheckRequestCount = 0;
    server.use(
      http.get('/api/recommendations/precheck', () => {
        precheckRequestCount += 1;

        return HttpResponse.json<ClothingShortagePrecheckResponse>({
          is_clothing_shortage: false,
          category_counts: { top: 3, bottom: 2, shoes: 2 },
          shortage_categories: [],
          notice_cd: null,
        });
      }),
    );
    renderPage();

    await waitFor(() => {
      expect(precheckRequestCount).toBe(1);
    });
    expect(
      screen.queryByRole('button', { name: '옷 등록하기' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  test('옷 부족 확인에 실패하면 안내 없이 입력 화면을 그대로 써야 한다.', async () => {
    let precheckRequestCount = 0;
    server.use(
      http.get('/api/recommendations/precheck', () => {
        precheckRequestCount += 1;

        return HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        );
      }),
    );
    renderPage();

    await waitFor(() => {
      expect(precheckRequestCount).toBe(1);
    });
    expect(
      screen.queryByRole('button', { name: '옷 등록하기' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(submitButton()).toBeEnabled();
  });
});

describe('입력값 복원', () => {
  const saveDraft = (start: { date: string; time: string }) => {
    sessionStorage.setItem(
      RECOMMENDATION_FORM_DRAFT_STORAGE_KEY,
      JSON.stringify({
        location: {
          sidoNm: '서울특별시',
          sigunguNm: '성동구',
          inputTypeCd: 'manual',
        },
        tpo: { cd: 'custom', text: '친구 결혼식' },
        customTpoText: '친구 결혼식',
        start,
        end: '15:00',
      }),
    );
  };

  test('취소하고 돌아오면 위치, 상황, 외출 시간을 그대로 채우고 초안은 지워야 한다.', async () => {
    saveDraft({ date: '2026-10-14', time: '10:00' });
    renderPage();

    expect(
      await screen.findByRole('button', { name: /^위치 서울 성동구/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /친구 결혼식/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: '외출 시간 나가는 시간 10:00' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '외출 시간 돌아오는 시간 15:00' }),
    ).toBeInTheDocument();
    expect(
      sessionStorage.getItem(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY),
    ).toBeNull();
  });

  test('돌아왔을 때 나가는 시간이 이미 지났으면 시간만 기본값으로 돌려야 한다.', async () => {
    saveDraft({ date: '2026-10-14', time: '08:00' });
    renderPage();

    expect(
      await screen.findByRole('button', { name: /^위치 서울 성동구/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /친구 결혼식/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: '외출 시간 나가는 시간 09:00' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '외출 시간 돌아오는 시간 14:00' }),
    ).toBeInTheDocument();
  });

  test('초안이 없으면 빈 입력 화면으로 시작해야 한다.', () => {
    renderPage();

    expect(
      screen.getByRole('button', { name: '위치 위치를 선택하세요' }),
    ).toBeInTheDocument();
  });
});
