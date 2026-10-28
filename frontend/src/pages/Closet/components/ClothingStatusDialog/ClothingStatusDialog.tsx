import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import type { ClothingStatusDialogVariant } from '@/pages/Closet/types';

interface ClothingStatusDialogProps {
  isOpen: boolean;
  variant: ClothingStatusDialogVariant;
  failureReason: string | null;
  isRetrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}

const ClothingStatusDialog = (props: ClothingStatusDialogProps) => {
  const { isOpen, variant, failureReason, isRetrying, onRetry, onClose } =
    props;

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (!nextIsOpen) {
      onClose();
    }
  };

  if (variant === 'processing') {
    return (
      <Dialog
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        title="아직 처리 중이에요"
        description="배경을 지우고 정보를 채우는 중이에요. 끝나면 자세히 볼 수 있어요."
        footer={
          <>
            <Button isFullWidth onClick={onClose}>
              닫기
            </Button>
            <Button variant="text" isFullWidth>
              삭제
            </Button>
          </>
        }
      />
    );
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title="등록하지 못했어요"
      description={failureReason ?? undefined}
      footer={
        <>
          <Button
            icon="refresh"
            isFullWidth
            isLoading={isRetrying}
            onClick={onRetry}
          >
            재시도
          </Button>
          <Button variant="outline" isFullWidth>
            삭제
          </Button>
          <Button variant="text" isFullWidth onClick={onClose}>
            닫기
          </Button>
        </>
      }
    />
  );
};

export default ClothingStatusDialog;
