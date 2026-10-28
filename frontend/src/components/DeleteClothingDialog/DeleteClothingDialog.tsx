import { useQueryClient } from '@tanstack/react-query';
import { isUnauthorizedError } from '@/apis/authSession';
import { removeClothingCard } from '@/apis/clothingListCache';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import { showToast } from '@/components/common/ToastProvider/ToastProvider.toast';
import { useDeleteClothingClothingClothingIdDelete } from '@/generated/endpoints/clothing/clothing';
import * as S from './DeleteClothingDialog.styled';

// 프록시나 경로 문제로 난 404와 구분하려고, 서버가 옷을 찾지 못했다고 답한 경우만 이미 지워진 옷으로 본다.
const CLOTHING_NOT_FOUND_CODE = 'CLOTHING_NOT_FOUND';

const UNKNOWN_DELETE_ERROR = '삭제하지 못했어요.';

interface DeleteClothingDialogProps {
  clothingId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDeleted: () => void;
}

const DeleteClothingDialog = (props: DeleteClothingDialogProps) => {
  const { clothingId, isOpen, onOpenChange, onDeleted } = props;
  const queryClient = useQueryClient();

  const finishDeletion = (deletedId: number) => {
    removeClothingCard(queryClient, deletedId);
    showToast({ tone: 'success', title: '옷을 삭제했어요' });
  };

  /*
   * 요청 중에 뒤로 가기 등으로 모달이 사라져도 목록 정리와 토스트는 빠지지 않도록, mutate 콜백이 아닌 훅 옵션에서 처리한다.
   * 이미 지워진 옷이면 지우려던 목적은 이룬 것이다.
   */
  const deletion = useDeleteClothingClothingClothingIdDelete({
    mutation: {
      onSuccess: (_data, variables) => finishDeletion(variables.clothingId),
      onError: (error, variables) => {
        if (error.code === CLOTHING_NOT_FOUND_CODE) {
          finishDeletion(variables.clothingId);
        }
      },
    },
  });

  const handleDelete = () => {
    deletion.mutate(
      { clothingId },
      {
        onSuccess: onDeleted,
        onError: (error) => {
          if (error.code === CLOTHING_NOT_FOUND_CODE) {
            onDeleted();
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
    deletion.error.code !== CLOTHING_NOT_FOUND_CODE &&
    !isUnauthorizedError(deletion.error)
      ? deletion.error.message || UNKNOWN_DELETE_ERROR
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
