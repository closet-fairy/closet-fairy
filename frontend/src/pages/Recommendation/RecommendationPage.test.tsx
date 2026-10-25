import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { server } from '@/mocks/node';
import RecommendationPage from './RecommendationPage';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RecommendationPage />
    </QueryClientProvider>,
  );

const submitButton = () =>
  screen.getByRole('button', { name: '코디 추천 받기' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T09:10:00+09:00'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

    await user.click(startTrigger('09:00'));
    await user.click(await screen.findByRole('option', { name: '12:00' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    vi.setSystemTime(new Date('2026-10-14T09:40:00+09:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(startTrigger('12:00')).toBeInTheDocument();
  });

  test('나가는 시간만 고르면 돌아오는 시간은 고른 시간의 5시간 뒤가 되고, 슬롯이 바뀌어도 그대로여야 한다.', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(startTrigger('09:00'));
    await user.click(await screen.findByRole('option', { name: '14:30' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

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
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    renderPage();

    await user.click(screen.getByRole('button', { name: '출근' }));
    await user.click(submitButton());

    await waitFor(() => {
      expect(consoleInfo).toHaveBeenCalledWith('추천 세션을 만들었습니다.', {
        recommendation_session_id: 7,
        session_status_cd: 'active',
      });
    });
    expect(receivedBody).toEqual({
      sido_nm: '서울특별시',
      sigungu_nm: '성동구',
      location_input_type_cd: 'manual',
      tpo_cd: 'work',
      going_out_start_time: '09:00',
      going_out_end_time: '14:00',
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
    vi.spyOn(console, 'info').mockImplementation(() => {});
    renderPage();

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
    vi.spyOn(console, 'info').mockImplementation(() => {});
    renderPage();

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

    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '외출 시작 시각이 이미 지났습니다.',
    );
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

    await user.click(
      screen.getByRole('button', { name: '외출 시간 돌아오는 시간 14:00' }),
    );
    await user.click(await screen.findByRole('option', { name: '15:00' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await user.click(
      screen.getByRole('button', { name: '외출 시간 나가는 시간 09:00' }),
    );
    await user.click(await screen.findByRole('option', { name: '15:00' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '외출 시작과 종료 시각이 같습니다.',
    );
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

    await user.click(submitButton());
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: '운동' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

    await user.click(submitButton());
    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
