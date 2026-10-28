import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import type { RejectedClothingPhoto } from '@/pages/Closet/clothingUploadStore';
import * as S from './ServerRejectedDialog.styled';

interface ServerRejectedDialogProps {
  photos: RejectedClothingPhoto[];
  onConfirm: () => void;
}

const ServerRejectedDialog = (props: ServerRejectedDialogProps) => {
  const { photos, onConfirm } = props;

  return (
    <Dialog
      isOpen={photos.length > 0}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          onConfirm();
        }
      }}
      title={`${photos.length}장은 등록하지 못했어요`}
      footer={
        <Button isFullWidth onClick={onConfirm}>
          확인
        </Button>
      }
    >
      <S.List>
        {photos.map((photo, index) => (
          // 같은 이름의 사진을 여러 번 올릴 수 있어 순서까지 키에 넣는다.
          <S.Item key={`${index}-${photo.fileName}`}>
            <S.FileName>{photo.fileName}</S.FileName>
            <S.Message>{photo.message}</S.Message>
          </S.Item>
        ))}
      </S.List>
    </Dialog>
  );
};

export default ServerRejectedDialog;
