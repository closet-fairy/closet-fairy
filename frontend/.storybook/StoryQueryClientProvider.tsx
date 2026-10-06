import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface StoryQueryClientProviderProps {
  children: ReactNode;
}

const StoryQueryClientProvider = (props: StoryQueryClientProviderProps) => {
  const { children } = props;
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

export default StoryQueryClientProvider;
