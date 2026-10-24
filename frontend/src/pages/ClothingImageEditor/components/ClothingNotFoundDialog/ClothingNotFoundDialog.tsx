import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';

interface ClothingNotFoundDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
}

const ClothingNotFoundDialog = (props: ClothingNotFoundDialogProps) => {
  const { isOpen, onConfirm } = props;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          onConfirm();
        }
      }}
      title="옷을 찾을 수 없어요"
      description="이미 삭제된 옷일 수 있어요."
      footer={
        <Button isFullWidth onClick={onConfirm}>
          확인
        </Button>
      }
    />
  );
};

export default ClothingNotFoundDialog;
