import axios from 'axios';
import { toApiError } from './apiError';

export const httpClient = axios.create({
  baseURL: '/api',
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);
