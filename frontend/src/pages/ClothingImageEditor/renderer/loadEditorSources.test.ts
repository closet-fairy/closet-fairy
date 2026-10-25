import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '@/apis/apiError';
import { getIsSessionExpired, markSessionActive } from '@/apis/authSession';
import { EditorSourcesError, loadEditorSources } from './loadEditorSources';

const SOURCES = {
  originUrl: '/media/origin.jpg',
  cutoutUrl: null,
  maskUrl: null,
};

const stubFetchStatus = (status: number) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(null, { status }))),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('편집할 이미지 불러오기', () => {
  test('이미지 요청이 401을 받으면 세션 만료를 알리고 ApiError를 던져야 한다.', async () => {
    markSessionActive();
    stubFetchStatus(401);

    const error = await loadEditorSources(SOURCES).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toHaveProperty('status', 401);
    expect(getIsSessionExpired()).toBe(true);
  });

  test('401이 아닌 이유로 실패하면 세션 만료를 알리지 않고 불러오기 오류를 던져야 한다.', async () => {
    markSessionActive();
    stubFetchStatus(500);

    await expect(loadEditorSources(SOURCES)).rejects.toBeInstanceOf(
      EditorSourcesError,
    );
    expect(getIsSessionExpired()).toBe(false);
  });
});
