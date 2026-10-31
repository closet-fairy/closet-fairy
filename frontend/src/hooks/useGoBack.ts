import { useNavigate, useRouter } from '@tanstack/react-router';

type GoBackFallback = '/my-info' | '/recommendation-history';

const useGoBack = (fallback: GoBackFallback = '/my-info') => {
  const navigate = useNavigate();
  const router = useRouter();

  return () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({ to: fallback, replace: true });
  };
};

export default useGoBack;
