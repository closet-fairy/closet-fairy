import type { ZodType } from 'zod';
import { ApiError } from './apiError';
import { httpClient } from './httpClient';

type RequestOptions = Pick<
  RequestInit,
  'method' | 'headers' | 'body' | 'signal'
>;

interface FetcherOptions<T> extends RequestOptions {
  schema?: ZodType<T>;
}

// orval이 생성 코드에서 ErrorType<서버 에러 본문>으로 쓰므로 타입 매개변수 자리를 둔다.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<_ServerError> = ApiError;

const request = (url: string, init: RequestOptions) => {
  const { method, headers, body, signal } = init;

  return httpClient.request<unknown>({
    url,
    method,
    headers: Object.fromEntries(new Headers(headers)),
    data: body,
    signal: signal ?? undefined,
  });
};

export const fetcher = async <T>(
  url: string,
  options: FetcherOptions<T>,
): Promise<T> => {
  const { schema, ...init } = options;

  if (schema === undefined) {
    throw new ApiError({
      code: 'MISSING_RESPONSE_SCHEMA',
      message: '응답을 검증할 스키마가 없습니다.',
      status: null,
    });
  }

  const response = await request(url, init);
  const result = schema.safeParse(response.data);

  if (!result.success) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '서버 응답 형식이 올바르지 않습니다.',
      status: response.status,
      cause: result.error,
    });
  }

  return result.data;
};

export const noContentFetcher = async <T extends void>(
  url: string,
  options: RequestOptions,
): Promise<T | void> => {
  await request(url, options);
};
