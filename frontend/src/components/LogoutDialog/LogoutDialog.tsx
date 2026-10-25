import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import { useLogoutAuthLogoutPost } from '@/generated/endpoints/auth/auth';
import useEndSession from '@/hooks/useEndSession';
import * as S from './LogoutDialog.styled';

const LOGOUT_ERROR_MESSAGE = '로그아웃하지 못했어요. 다시 시도해 주세요.';

interface LogoutDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const LogoutDialog = (props: LogoutDialogProps) => {
  const { isOpen, onOpenChange } = props;
  const endSession = useEndSession();
  const logout = useLogoutAuthLogoutPost();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => void endSession(),
      onError: (error) => {
        if (isUnauthorizedError(error)) {
          void endSession();
        }
      },
    });
  };

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (!nextIsOpen) {
      logout.reset();
    }

    onOpenChange(nextIsOpen);
  };

  const hasError = logout.isError && !isUnauthorizedError(logout.error);

  return (
    <Dialog
      isOpen={isOpen}
      isDismissable={!logout.isPending}
      onOpenChange={handleOpenChange}
      title="로그아웃하시겠어요?"
      footer={
        <>
          <Button
            isFullWidth
            isLoading={logout.isPending}
            onClick={handleLogout}
          >
            로그아웃
          </Button>
          <Button
            variant="text"
            isFullWidth
            isDisabled={logout.isPending}
            onClick={() => handleOpenChange(false)}
          >
            취소
          </Button>
        </>
      }
    >
      {hasError && (
        <S.ErrorMessage role="alert">{LOGOUT_ERROR_MESSAGE}</S.ErrorMessage>
      )}
    </Dialog>
  );
};

export default LogoutDialog;
