import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { resetSession } from '@/apis/authSession';

const useEndSession = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(async () => {
    resetSession();
    queryClient.clear();
    await navigate({ to: '/login', replace: true, ignoreBlocker: true });
  }, [navigate, queryClient]);
};

export default useEndSession;
