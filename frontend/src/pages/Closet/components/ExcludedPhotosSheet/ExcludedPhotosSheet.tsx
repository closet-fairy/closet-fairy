import BottomSheet from '@/components/common/BottomSheet';
import Button from '@/components/common/Button';
import * as S from './ExcludedPhotosSheet.styled';

interface ExcludedPhoto {
  id: string;
  fileName: string;
  message: string;
}

interface ExcludedPhotosSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  photos: ExcludedPhoto[];
}

const ExcludedPhotosSheet = (props: ExcludedPhotosSheetProps) => {
  const { isOpen, onOpenChange, photos } = props;

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={`제외된 사진 ${photos.length}장`}
      footer={
        <Button isFullWidth onClick={() => onOpenChange(false)}>
          확인
        </Button>
      }
    >
      <S.List>
        {photos.map((photo) => (
          <S.Item key={photo.id}>
            <S.FileName>{photo.fileName}</S.FileName>
            <S.Message>{photo.message}</S.Message>
          </S.Item>
        ))}
      </S.List>
    </BottomSheet>
  );
};

export default ExcludedPhotosSheet;
