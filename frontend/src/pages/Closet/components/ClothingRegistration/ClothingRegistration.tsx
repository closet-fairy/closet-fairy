import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  UPLOAD_PHOTO_LIMIT,
  validateUploadPhoto,
} from '@/domains/clothing/validateUploadPhoto';
import { startClothingUpload } from '@/pages/Closet/clothingUploadStore';
import OverLimitDialog from '@/pages/Closet/components/OverLimitDialog';
import PhotoConfirmDialog from '@/pages/Closet/components/PhotoConfirmDialog';
import RegisterSheet from '@/pages/Closet/components/RegisterSheet';
import type { PickedPhoto } from '@/pages/Closet/types';
import * as S from './ClothingRegistration.styled';

interface ClothingRegistrationProps {
  isSheetOpen: boolean;
  onSheetOpenChange: (isOpen: boolean) => void;
}

// 확장자가 image/*에 묶이지 않는 기기에서도 HEIC 사진을 고를 수 있게 확장자를 함께 적는다.
const GALLERY_ACCEPT = 'image/*,.heic,.heif';

const ClothingRegistration = (props: ClothingRegistrationProps) => {
  const { isSheetOpen, onSheetOpenChange } = props;
  const queryClient = useQueryClient();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState<{ key: number; photos: PickedPhoto[] }>({
    key: 0,
    photos: [],
  });
  const [isOverLimitOpen, setIsOverLimitOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  /*
   * 이 화면이 만든 미리보기 주소 중 업로드 쪽에 넘기지 않은 것을 모아 둔다. 닫히는 동안에도 미리보기가
   * 보여야 해서 바로 풀지 않고, 다음에 사진을 고를 때나 화면을 떠날 때 푼다.
   */
  const ownedUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    const ownedUrls = ownedUrlsRef.current;

    return () => {
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const releaseOwnedUrls = () => {
    ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedUrlsRef.current.clear();
  };

  const createPreviewUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    ownedUrlsRef.current.add(url);
    return url;
  };

  // 등록한 사진의 주소는 임시 카드가 이어서 쓰므로 업로드 쪽에서 푼다.
  const handOverPhotos = (photos: PickedPhoto[]) => {
    photos.forEach((photo) => ownedUrlsRef.current.delete(photo.previewUrl));
    void startClothingUpload(
      queryClient,
      photos.map((photo) => ({
        file: photo.file,
        previewUrl: photo.previewUrl,
      })),
    );
  };

  const openGallery = () => {
    onSheetOpenChange(false);
    galleryInputRef.current?.click();
  };

  const handleGalleryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    // 같은 사진을 다시 골라도 change가 일어나도록 비운다.
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    releaseOwnedUrls();
    const photos = files.map((file): PickedPhoto => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: createPreviewUrl(file),
      rejectMessage: validateUploadPhoto(file),
    }));
    const acceptedCount = photos.filter(
      (photo) => photo.rejectMessage === null,
    ).length;

    setPick((previous) => ({ key: previous.key + 1, photos }));

    if (acceptedCount > UPLOAD_PHOTO_LIMIT) {
      setIsOverLimitOpen(true);
      return;
    }

    setIsConfirmOpen(true);
  };

  const submit = (selectedPhotos: PickedPhoto[]) => {
    // 닫히는 동안 버튼이 한 번 더 눌려도 같은 사진을 두 번 보내지 않는다.
    if (!isConfirmOpen) {
      return;
    }

    setIsConfirmOpen(false);
    // 스크롤을 내린 채 등록해도 맨 앞에 생긴 임시 카드가 보이게 한다.
    window.scrollTo({ top: 0 });
    handOverPhotos(selectedPhotos);
  };

  return (
    <>
      <RegisterSheet
        isOpen={isSheetOpen}
        onOpenChange={onSheetOpenChange}
        onSelectGallery={openGallery}
      />
      <S.HiddenInput
        ref={galleryInputRef}
        type="file"
        accept={GALLERY_ACCEPT}
        multiple
        aria-label="갤러리에서 고를 사진"
        onChange={handleGalleryChange}
      />
      <OverLimitDialog
        isOpen={isOverLimitOpen}
        onConfirm={() => {
          setIsOverLimitOpen(false);
          setIsConfirmOpen(true);
        }}
      />
      <PhotoConfirmDialog
        key={pick.key}
        isOpen={isConfirmOpen}
        photos={pick.photos}
        onClose={() => setIsConfirmOpen(false)}
        onSubmit={submit}
      />
    </>
  );
};

export default ClothingRegistration;
