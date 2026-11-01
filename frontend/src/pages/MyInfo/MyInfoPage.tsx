import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import ListItem from '@/components/common/ListItem';
import Notice from '@/components/common/Notice';
import TopBar from '@/components/common/TopBar';
import LogoutDialog from '@/components/LogoutDialog';
import { LOAD_ERROR_MESSAGE } from '@/constants/loadErrorMessage';
import { getKstYear } from '@/domains/member/birthYear';
import { PROVIDER_LABEL } from '@/domains/member/memberSettingOptions';
import {
  useGetMeMembersMeGet,
  useGetMySettingsMembersMeSettingsGet,
} from '@/generated/endpoints/member/member';
import SettingSummary from './components/SettingSummary';
import SettingSummarySkeleton from './components/SettingSummarySkeleton';
import * as S from './MyInfoPage.styled';

const KST_DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const getWithdrawErrorMessage = (reason: string) => {
  switch (reason) {
    case 'cancelled':
      return '본인 확인을 취소해 탈퇴하지 않았어요.';
    case 'account_mismatch':
      return '가입한 계정과 다른 계정으로 확인해 탈퇴하지 않았어요.';
    default:
      return '탈퇴하지 못했어요. 다시 시도해 주세요.';
  }
};

const MyInfoPage = () => {
  const search = useSearch({ from: '/my-info' });
  const navigate = useNavigate();
  const [withdrawError] = useState(search.withdraw_error);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const { data: me } = useGetMeMembersMeGet();
  const settingsQuery = useGetMySettingsMembersMeSettingsGet();
  const hasSearch = search.withdraw_error !== undefined;

  useEffect(() => {
    if (hasSearch) {
      void navigate({ to: '/my-info', search: {}, replace: true });
    }
  }, [hasSearch, navigate]);

  const isSettingsFailed =
    settingsQuery.data === undefined &&
    settingsQuery.isError &&
    !isUnauthorizedError(settingsQuery.error);

  return (
    <S.Container>
      <TopBar
        title="내 정보"
        trailing={
          <Button
            variant="text"
            size="md"
            icon="edit"
            onClick={() => void navigate({ to: '/my-info/edit' })}
          >
            수정
          </Button>
        }
      />
      <S.Content>
        {withdrawError !== undefined && (
          <div role="alert">
            <Notice
              icon="error"
              title={getWithdrawErrorMessage(withdrawError)}
            />
          </div>
        )}
        {me && (
          <S.Profile>
            <S.Nickname>{me.nickname}</S.Nickname>
            <S.Account>
              {PROVIDER_LABEL[me.provider_cd]} 계정 ·{' '}
              {KST_DATE_FORMAT.format(new Date(me.created_at))} 가입
            </S.Account>
          </S.Profile>
        )}
        <S.Section>
          <S.SectionTitle>추천에 쓰이는 정보</S.SectionTitle>
          {settingsQuery.isPending && (
            <>
              <SettingSummarySkeleton />
              <S.LoadingMessage role="status">불러오고 있어요</S.LoadingMessage>
            </>
          )}
          {settingsQuery.data && (
            <SettingSummary
              settings={settingsQuery.data}
              currentYear={getKstYear(new Date())}
            />
          )}
          {isSettingsFailed && (
            <div role="alert">
              <Notice
                variant="subtle"
                icon="error"
                title={LOAD_ERROR_MESSAGE}
                action={
                  <Button
                    variant="outline"
                    size="md"
                    isFullWidth
                    isLoading={settingsQuery.isFetching}
                    onClick={() => void settingsQuery.refetch()}
                  >
                    다시 시도
                  </Button>
                }
              />
            </div>
          )}
        </S.Section>
        <S.Section>
          <S.SectionTitle>계정</S.SectionTitle>
          <div>
            <ListItem
              icon="logout"
              title="로그아웃"
              hasChevron
              onClick={() => setIsLogoutDialogOpen(true)}
            />
            <ListItem
              icon="person_remove"
              title="회원 탈퇴"
              hasChevron
              onClick={() => void navigate({ to: '/my-info/withdraw' })}
            />
          </div>
        </S.Section>
      </S.Content>
      <LogoutDialog
        isOpen={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
      />
    </S.Container>
  );
};

export default MyInfoPage;
