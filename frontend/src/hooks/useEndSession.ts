import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { resetSession } from '@/apis/authSession';
import {
  PENDING_RECOMMENDATION_STORAGE_KEY,
  RECOMMENDATION_FORM_DRAFT_STORAGE_KEY,
} from '@/constants/recommendationStorageKey';
import { removeSessionItem } from '@/utils/sessionStorageJson';

const useEndSession = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(async () => {
    resetSession();
    queryClient.clear();
    // 같은 탭에서 다른 계정으로 로그인해도 이전 계정의 위치·상황이 채워지지 않게 한다.
    removeSessionItem(PENDING_RECOMMENDATION_STORAGE_KEY);
    removeSessionItem(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY);
    await navigate({ to: '/login', replace: true, ignoreBlocker: true });
  }, [navigate, queryClient]);
};

export default useEndSession;
