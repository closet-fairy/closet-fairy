import { useQueryClient } from '@tanstack/react-query';
import { isUnauthorizedError } from '@/apis/authSession';
import { removeClothingCard } from '@/apis/clothingListCache';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import { showToast } from '@/components/common/ToastProvider/ToastProvider.toast';
import { useDeleteClothingClothingClothingIdDelete } from '@/generated/endpoints/clothing/clothing';
import * as S from './DeleteClothingDialog.styled';

const NOT_FOUND_STATUS = 404;

interface DeleteClothingDialogProps {
  clothingId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDeleted: () => void;
}

const DeleteClothingDialog = (props: DeleteClothingDialogProps) => {
  const { clothingId, isOpen, onOpenChange, onDeleted } = props;
  const queryClient = useQueryClient();
  const deletion = useDeleteClothingClothingClothingIdDelete();

  const finishDeletion = () => {
    removeClothingCard(queryClient, clothingId);
    showToast({ tone: 'success', title: '옷을 삭제했어요' });
    onDeleted();
  };

  const handleDelete = () => {
    deletion.mutate(
      { clothingId },
      {
        onSuccess: finishDeletion,
        onError: (error) => {
          // 이미 지워진 옷이면 지우려던 목적은 이룬 것이다.
          if (error.status === NOT_FOUND_STATUS) {
            finishDeletion();
          }
        },
      },
    );
  };

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (!nextIsOpen) {
      deletion.reset();
    }

    onOpenChange(nextIsOpen);
  };

  // 로그인 만료는 전역 다이얼로그가 안내하므로 여기서는 보여 주지 않는다.
  const errorMessage =
    deletion.isError &&
    deletion.error.status !== NOT_FOUND_STATUS &&
    !isUnauthorizedError(deletion.error)
      ? deletion.error.message
      : null;

  return (
    <Dialog
      isOpen={isOpen}
      isDismissable={!deletion.isPending}
      onOpenChange={handleOpenChange}
      title="이 옷을 삭제할까요?"
      description="사진과 속성이 함께 지워지며 되돌릴 수 없습니다."
      footer={
        <>
          <Button
            variant="outline"
            isFullWidth
            isLoading={deletion.isPending}
            onClick={handleDelete}
          >
            삭제
          </Button>
          <Button
            variant="text"
            isFullWidth
            isDisabled={deletion.isPending}
            onClick={() => handleOpenChange(false)}
          >
            취소
          </Button>
        </>
      }
    >
      {errorMessage !== null && (
        <S.ErrorMessage role="alert">{errorMessage}</S.ErrorMessage>
      )}
    </Dialog>
  );
};

export default DeleteClothingDialog;
