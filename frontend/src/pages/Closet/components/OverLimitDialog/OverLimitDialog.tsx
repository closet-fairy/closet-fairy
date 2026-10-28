import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import { UPLOAD_PHOTO_LIMIT } from '@/domains/clothing/uploadPhoto';

interface OverLimitDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
}

const OverLimitDialog = (props: OverLimitDialogProps) => {
  const { isOpen, onConfirm } = props;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          onConfirm();
        }
      }}
      title={`최대 ${UPLOAD_PHOTO_LIMIT}장까지 등록할 수 있어요`}
      description={`앞의 ${UPLOAD_PHOTO_LIMIT}장만 골라 둘게요. 사진 확인 화면에서 바꿀 수 있어요.`}
      footer={
        <Button isFullWidth onClick={onConfirm}>
          확인
        </Button>
      }
    />
  );
};

export default OverLimitDialog;
