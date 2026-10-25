import { useNavigate, useRouter } from '@tanstack/react-router';

const useGoBack = () => {
  const navigate = useNavigate();
  const router = useRouter();

  return () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({ to: '/my-info', replace: true });
  };
};

export default useGoBack;
