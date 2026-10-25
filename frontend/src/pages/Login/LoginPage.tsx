import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import AppBrand from '@/components/AppBrand';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import Notice from '@/components/common/Notice';
import * as S from './LoginPage.styled';

type Provider = 'google' | 'kakao';

const LOGIN_URL: Record<Provider, string> = {
  google: '/api/auth/google/login',
  kakao: '/api/auth/kakao/login',
};

const CANCELLED_REASON = 'cancelled';

const getLoginErrorMessage = (reason: string) =>
  reason === CANCELLED_REASON
    ? '동의를 취소했어요. 다시 시도해 주세요.'
    : '로그인하지 못했어요. 다시 시도해 주세요.';

const LoginPage = () => {
  const search = useSearch({ from: '/login' });
  const navigate = useNavigate();
  const [errorReason] = useState(search.error);
  const [isWithdrawnNoticeOpen, setIsWithdrawnNoticeOpen] = useState(
    search.withdrawn !== undefined,
  );
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasSearch =
    search.error !== undefined || search.withdrawn !== undefined;

  useEffect(() => {
    if (hasSearch) {
      void navigate({ to: '/login', search: {}, replace: true });
    }
  }, [hasSearch, navigate]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsRedirecting(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const handleLogin = (provider: Provider) => {
    setIsRedirecting(true);
    window.location.assign(LOGIN_URL[provider]);
  };

  return (
    <S.Container>
      {errorReason !== undefined && !isRedirecting && (
        <S.Banner role="alert">
          <Notice icon="error" title={getLoginErrorMessage(errorReason)} />
        </S.Banner>
      )}
      <S.Brand>
        <AppBrand />
      </S.Brand>
      <S.Actions>
        <Button
          variant="outline"
          isFullWidth
          isDisabled={isRedirecting}
          onClick={() => handleLogin('google')}
        >
          구글로 시작하기
        </Button>
        <Button
          variant="outline"
          isFullWidth
          isDisabled={isRedirecting}
          onClick={() => handleLogin('kakao')}
        >
          카카오로 시작하기
        </Button>
      </S.Actions>
      <Dialog
        isOpen={isWithdrawnNoticeOpen}
        onOpenChange={() => {}}
        isDismissable={false}
        title="탈퇴가 완료되었습니다"
        description="그동안 이용해 주셔서 감사합니다. 계정과 등록한 옷은 모두 삭제되었습니다."
        footer={
          <Button isFullWidth onClick={() => setIsWithdrawnNoticeOpen(false)}>
            확인
          </Button>
        }
      />
    </S.Container>
  );
};

export default LoginPage;
