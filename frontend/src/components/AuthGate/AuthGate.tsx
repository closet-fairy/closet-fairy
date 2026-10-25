import { Navigate, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { isUnauthorizedError, markSessionActive } from '@/apis/authSession';
import Button from '@/components/common/Button';
import StatusView from '@/components/common/StatusView';
import SplashScreen from '@/components/SplashScreen';
import type { AuthStatus } from '@/domains/auth/resolveAuthRedirect';
import { resolveAuthRedirect } from '@/domains/auth/resolveAuthRedirect';
import { useGetMeMembersMeGet } from '@/generated/endpoints/member/member';
import * as S from './AuthGate.styled';

const LOAD_ERROR_TITLE = '정보를 불러오지 못했어요';

interface AuthGateProps {
  children: ReactNode;
}

const AuthGate = (props: AuthGateProps) => {
  const { children } = props;
  const pathname = useLocation({ select: (location) => location.pathname });
  const { data: me, error, refetch, isFetching } = useGetMeMembersMeGet();

  useEffect(() => {
    if (me !== undefined) {
      markSessionActive();
    }
  }, [me]);

  if (me === undefined && error === null) {
    return <SplashScreen />;
  }

  if (me === undefined && !isUnauthorizedError(error)) {
    return (
      <S.ErrorContainer>
        <StatusView
          title={LOAD_ERROR_TITLE}
          description={error?.message}
          actions={
            <Button
              isFullWidth
              isLoading={isFetching}
              onClick={() => void refetch()}
            >
              다시 시도
            </Button>
          }
        />
      </S.ErrorContainer>
    );
  }

  const status: AuthStatus =
    me === undefined
      ? 'signedOut'
      : me.is_onboarded
        ? 'onboarded'
        : 'needsOnboarding';
  const redirectPath = resolveAuthRedirect(pathname, status);

  if (redirectPath !== null) {
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default AuthGate;
