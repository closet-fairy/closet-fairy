import { isAxiosError, isCancel } from 'axios';
import { z } from 'zod';

interface ApiErrorParams {
  code: string;
  message: string;
  status: number | null;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(params: ApiErrorParams) {
    const { code, message, status, cause } = params;

    super(message, { cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const serverErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const toApiError = (error: unknown): ApiError => {
  if (isCancel(error)) {
    return new ApiError({
      code: 'CANCELED',
      message: '요청이 취소되었습니다.',
      status: null,
      cause: error,
    });
  }

  if (!isAxiosError(error)) {
    return new ApiError({
      code: 'UNKNOWN_ERROR',
      message: '알 수 없는 오류가 발생했습니다.',
      status: null,
      cause: error,
    });
  }

  if (error.response === undefined) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: '서버에 연결할 수 없습니다.',
      status: null,
      cause: error,
    });
  }

  const { status } = error.response;
  const result = serverErrorSchema.safeParse(error.response.data);

  if (result.success) {
    return new ApiError({ ...result.data, status, cause: error });
  }

  return new ApiError({
    code: 'UNKNOWN_ERROR',
    message: '알 수 없는 오류가 발생했습니다.',
    status,
    cause: error,
  });
};
