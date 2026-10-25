import { useNavigate, useRouter } from '@tanstack/react-router';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import IconButton from '@/components/common/IconButton';
import StatusView from '@/components/common/StatusView';
import TopBar from '@/components/common/TopBar';
import {
  useGetMeMembersMeGet,
  useGetMySettingsMembersMeSettingsGet,
} from '@/generated/endpoints/member/member';
import ProfileEditForm from './components/ProfileEditForm';
import * as S from './ProfileEditPage.styled';

const ProfileEditPage = () => {
  const navigate = useNavigate();
  const router = useRouter();
  const meQuery = useGetMeMembersMeGet();
  const settingsQuery = useGetMySettingsMembersMeSettingsGet();

  if (meQuery.data && settingsQuery.data) {
    return <ProfileEditForm me={meQuery.data} settings={settingsQuery.data} />;
  }

  const isFailed =
    settingsQuery.isError && !isUnauthorizedError(settingsQuery.error);

  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({ to: '/my-info', replace: true });
  };

  return (
    <S.Container>
      <TopBar
        title="프로필 수정"
        leading={
          <IconButton
            icon="arrow_back"
            aria-label="뒤로 가기"
            onClick={goBack}
          />
        }
      />
      {isFailed ? (
        <StatusView
          title="정보를 불러오지 못했어요"
          description={settingsQuery.error.message}
          actions={
            <Button
              isFullWidth
              isLoading={settingsQuery.isFetching}
              onClick={() => void settingsQuery.refetch()}
            >
              다시 시도
            </Button>
          }
        />
      ) : (
        <StatusView title="불러오고 있어요" />
      )}
    </S.Container>
  );
};

export default ProfileEditPage;
