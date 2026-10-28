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
  // 닫히는 동안에도 미리보기가 보여야 해서, 등록하지 않은 사진의 주소는 다음에 고를 때나 화면을 떠날 때 푼다.
  const staleUrlsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      staleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const releaseStaleUrls = () => {
    staleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    staleUrlsRef.current = [];
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

    releaseStaleUrls();
    const photos = files.map((file): PickedPhoto => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
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

  const closeConfirm = () => {
    setIsConfirmOpen(false);
    staleUrlsRef.current = pick.photos.map((photo) => photo.previewUrl);
  };

  const submit = (selectedPhotos: PickedPhoto[]) => {
    const selectedIds = new Set(selectedPhotos.map((photo) => photo.id));
    setIsConfirmOpen(false);
    // 등록한 사진의 주소는 임시 카드가 이어서 쓰므로 업로드 쪽에서 푼다.
    staleUrlsRef.current = pick.photos
      .filter((photo) => !selectedIds.has(photo.id))
      .map((photo) => photo.previewUrl);
    // 스크롤을 내린 채 등록해도 맨 앞에 생긴 임시 카드가 보이게 한다.
    window.scrollTo({ top: 0 });
    void startClothingUpload(
      queryClient,
      selectedPhotos.map((photo) => ({
        file: photo.file,
        previewUrl: photo.previewUrl,
      })),
    );
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
        onClose={closeConfirm}
        onSubmit={submit}
      />
    </>
  );
};

export default ClothingRegistration;
