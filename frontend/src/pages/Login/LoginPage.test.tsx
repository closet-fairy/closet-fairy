import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setMockMemberStatus } from '@/mocks/handlers/member';
import { routeTree } from '@/routeTree.gen';

const assign = vi.fn();

const renderAt = async (path: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { history };
};

beforeEach(() => {
  setMockMemberStatus('signedOut');
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  assign.mockReset();
  vi.unstubAllGlobals();
});

describe('소셜 로그인 시작', () => {
  test('Google로 로그인을 누르면 구글 로그인 주소로 이동하고 두 버튼을 모두 막아야 한다.', async () => {
    const user = userEvent.setup();
    await renderAt('/login');

    await user.click(
      await screen.findByRole('button', { name: 'Google로 로그인' }),
    );

    expect(assign).toHaveBeenCalledWith('/api/auth/google/login');
    expect(
      screen.getByRole('button', { name: 'Google로 로그인' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '카카오 로그인' }),
    ).toBeDisabled();
  });

  test('카카오 로그인을 누르면 카카오 로그인 주소로 이동해야 한다.', async () => {
    const user = userEvent.setup();
    await renderAt('/login');

    await user.click(
      await screen.findByRole('button', { name: '카카오 로그인' }),
    );

    expect(assign).toHaveBeenCalledWith('/api/auth/kakao/login');
  });
});

describe('로그인 실패 안내', () => {
  test('동의를 취소하고 돌아오면 취소 안내를 보여 주고 주소의 사유를 지워야 한다.', async () => {
    const { history } = await renderAt('/login?error=cancelled');

    expect(
      await screen.findByText('동의를 취소했어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(history.location.search).toBe('');
    });
    expect(
      screen.getByText('동의를 취소했어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
  });

  test('그 밖의 사유로 실패하면 공통 실패 안내를 보여 줘야 한다.', async () => {
    await renderAt('/login?error=invalid_state');

    expect(
      await screen.findByText('로그인하지 못했어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
  });
});

describe('탈퇴 완료 안내', () => {
  test('탈퇴를 마치고 돌아오면 확인을 누를 때까지 탈퇴 완료 안내를 보여 줘야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = await renderAt('/login?withdrawn=1');

    expect(
      await screen.findByRole('dialog', { name: '탈퇴가 완료되었습니다' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(history.location.search).toBe('');
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
