import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { server } from '@/mocks/node';
import { ApiError } from './apiError';
import { fetcher, noContentFetcher } from './fetcher';

const itemSchema = z.object({ id: z.number(), name: z.string() });

describe('응답 검증', () => {
  test('응답이 스키마와 맞으면 검증된 데이터를 돌려줘야 한다.', async () => {
    server.use(
      http.get('/api/items/1', () =>
        HttpResponse.json({ id: 1, name: '셔츠' }),
      ),
    );

    await expect(
      fetcher('/items/1', { method: 'GET', schema: itemSchema }),
    ).resolves.toEqual({ id: 1, name: '셔츠' });
  });

  test('응답이 스키마와 다르면 INVALID_RESPONSE 코드의 ApiError를 던져야 한다.', async () => {
    server.use(http.get('/api/items/1', () => HttpResponse.json({ id: '1' })));

    const error = await fetcher('/items/1', {
      method: 'GET',
      schema: itemSchema,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });

  test('스키마 없이 호출하면 요청을 보내지 않고 MISSING_RESPONSE_SCHEMA 코드의 ApiError를 던져야 한다.', async () => {
    let requestCount = 0;
    server.use(
      http.get('/api/items/1', () => {
        requestCount += 1;
        return HttpResponse.json({ id: 1, name: '셔츠' });
      }),
    );

    await expect(fetcher('/items/1', { method: 'GET' })).rejects.toMatchObject({
      code: 'MISSING_RESPONSE_SCHEMA',
    });
    expect(requestCount).toBe(0);
  });
});

describe('요청 전달', () => {
  test('메서드, 헤더, 본문을 그대로 서버에 보내야 한다.', async () => {
    let receivedBody: unknown;
    let receivedContentType: string | null = null;
    server.use(
      http.post('/api/items', async ({ request }) => {
        receivedContentType = request.headers.get('Content-Type');
        receivedBody = await request.json();
        return HttpResponse.json({ id: 2, name: '바지' }, { status: 201 });
      }),
    );

    await fetcher('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '바지' }),
      schema: itemSchema,
    });

    expect(receivedContentType).toBe('application/json');
    expect(receivedBody).toEqual({ name: '바지' });
  });

  test('FormData 본문은 boundary가 붙은 multipart 요청으로 보내야 한다.', async () => {
    let receivedContentType: string | null = null;
    let receivedName: FormDataEntryValue | null = null;
    server.use(
      http.post('/api/items', async ({ request }) => {
        receivedContentType = request.headers.get('Content-Type');
        receivedName = (await request.formData()).get('name');
        return HttpResponse.json({ id: 3, name: '모자' }, { status: 201 });
      }),
    );
    const formData = new FormData();
    formData.append('name', '모자');

    await fetcher('/items', {
      method: 'POST',
      body: formData,
      schema: itemSchema,
    });

    expect(receivedContentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(receivedName).toBe('모자');
  });
});

describe('서버 에러', () => {
  test('서버가 에러 응답을 주면 서버의 code와 message를 담은 ApiError를 던져야 한다.', async () => {
    server.use(
      http.post('/api/items', () =>
        HttpResponse.json(
          { code: 'VALIDATION_ERROR', message: '이름을 입력해 주세요.' },
          { status: 422 },
        ),
      ),
    );

    const error = await fetcher('/items', {
      method: 'POST',
      schema: itemSchema,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: '이름을 입력해 주세요.',
      status: 422,
    });
  });
});

describe('본문 없는 응답', () => {
  test('204 응답이면 값 없이 끝나야 한다.', async () => {
    server.use(
      http.delete(
        '/api/items/1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(
      noContentFetcher('/items/1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  test('서버가 에러 응답을 주면 서버의 code를 담은 ApiError를 던져야 한다.', async () => {
    server.use(
      http.delete('/api/items/1', () =>
        HttpResponse.json(
          { code: 'NOT_FOUND', message: '요청한 리소스를 찾을 수 없습니다.' },
          { status: 404 },
        ),
      ),
    );

    await expect(
      noContentFetcher('/items/1', { method: 'DELETE' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('요청 취소', () => {
  test('취소된 signal로 요청하면 CANCELED 코드의 ApiError를 던져야 한다.', async () => {
    server.use(
      http.get('/api/items/1', () =>
        HttpResponse.json({ id: 1, name: '셔츠' }),
      ),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetcher('/items/1', {
        method: 'GET',
        signal: controller.signal,
        schema: itemSchema,
      }),
    ).rejects.toMatchObject({ code: 'CANCELED' });
  });
});
