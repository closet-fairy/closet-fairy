import axios from 'axios';
import { toApiError } from './apiError';
import { isUnauthorizedError, reportUnauthorized } from './authSession';

export const httpClient = axios.create({
  baseURL: '/api',
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);

    if (isUnauthorizedError(apiError)) {
      reportUnauthorized();
    }

    return Promise.reject(apiError);
  },
);
