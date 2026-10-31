import { useNavigate, useRouter } from '@tanstack/react-router';
import type { NavigateOptions } from '@tanstack/react-router';

const useGoBack = (fallback: NavigateOptions = { to: '/my-info' }) => {
  const navigate = useNavigate();
  const router = useRouter();

  return () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({ ...fallback, replace: true });
  };
};

export default useGoBack;
