import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiError';

const MAX_RETRY_COUNT = 3;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (!(error instanceof ApiError)) {
          return false;
        }

        if (error.status !== null && error.status < 500) {
          return false;
        }

        return failureCount < MAX_RETRY_COUNT;
      },
    },
  },
});
