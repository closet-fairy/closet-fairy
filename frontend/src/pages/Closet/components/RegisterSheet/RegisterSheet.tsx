import BottomSheet from '@/components/common/BottomSheet';
import ListItem from '@/components/common/ListItem';
import * as S from './RegisterSheet.styled';

interface RegisterSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelectCamera?: () => void;
  onSelectGallery: () => void;
}

const RegisterSheet = (props: RegisterSheetProps) => {
  const { isOpen, onOpenChange, onSelectCamera, onSelectGallery } = props;

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange} title="옷 등록">
      <S.List>
        <ListItem
          icon="photo_camera"
          title="사진 촬영"
          hasChevron
          onClick={onSelectCamera}
        />
        <ListItem
          icon="photo_library"
          title="갤러리에서 선택"
          description="최대 20장까지 고를 수 있어요"
          hasChevron
          onClick={onSelectGallery}
        />
      </S.List>
    </BottomSheet>
  );
};

export default RegisterSheet;
