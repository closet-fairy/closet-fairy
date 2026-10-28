import { useState } from 'react';
import Button from '@/components/common/Button';
import FullScreenDialog from '@/components/common/FullScreenDialog';
import Notice from '@/components/common/Notice';
import { UPLOAD_PHOTO_LIMIT } from '@/domains/clothing/uploadPhoto';
import ExcludedPhotosSheet from '@/pages/Closet/components/ExcludedPhotosSheet';
import PhotoTile from '@/pages/Closet/components/PhotoTile';
import type { PhotoTileState, PickedPhoto } from '@/pages/Closet/types';
import * as S from './PhotoConfirmDialog.styled';

interface PhotoConfirmDialogProps {
  isOpen: boolean;
  photos: PickedPhoto[];
  onClose: () => void;
  onSubmit: (photos: PickedPhoto[]) => void;
}

const PhotoConfirmDialog = (props: PhotoConfirmDialogProps) => {
  const { isOpen, photos, onClose, onSubmit } = props;
  const acceptedPhotos = photos.filter((photo) => photo.rejectMessage === null);
  const excludedPhotos = photos.flatMap((photo) =>
    photo.rejectMessage === null
      ? []
      : [
          {
            id: photo.id,
            fileName: photo.file.name,
            message: photo.rejectMessage,
          },
        ],
  );
  // 처음에는 모두 고른 상태로 두되, 20장을 넘게 가져왔으면 앞의 20장만 고른다.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        acceptedPhotos.slice(0, UPLOAD_PHOTO_LIMIT).map((photo) => photo.id),
      ),
  );
  const [isExcludedSheetOpen, setIsExcludedSheetOpen] = useState(false);
  const isFull = selectedIds.size >= UPLOAD_PHOTO_LIMIT;

  const getTileState = (photoId: string): PhotoTileState => {
    if (selectedIds.has(photoId)) {
      return 'selected';
    }

    return isFull ? 'locked' : 'discarded';
  };

  const togglePhoto = (photoId: string) => {
    setSelectedIds((ids) => {
      const nextIds = new Set(ids);

      if (nextIds.has(photoId)) {
        nextIds.delete(photoId);
      } else if (nextIds.size < UPLOAD_PHOTO_LIMIT) {
        nextIds.add(photoId);
      }

      return nextIds;
    });
  };

  return (
    <FullScreenDialog
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          onClose();
        }
      }}
      title="사진 확인"
      footer={
        <Button
          isFullWidth
          isDisabled={selectedIds.size === 0}
          onClick={() =>
            onSubmit(
              acceptedPhotos.filter((photo) => selectedIds.has(photo.id)),
            )
          }
        >
          {`${selectedIds.size}벌 등록하기`}
        </Button>
      }
    >
      <S.Body>
        {excludedPhotos.length > 0 && (
          <Notice
            icon="block"
            title={`${excludedPhotos.length}장은 형식·용량 때문에 제외됐어요`}
            action={
              <Button
                variant="text"
                size="sm"
                aria-haspopup="dialog"
                onClick={() => setIsExcludedSheetOpen(true)}
              >
                자세히
              </Button>
            }
          />
        )}
        <S.Heading>
          <S.HeadingTitle>등록할 사진을 골라주세요</S.HeadingTitle>
          <S.HeadingCount $isFull={isFull}>
            {isFull
              ? `${selectedIds.size} / ${UPLOAD_PHOTO_LIMIT}장`
              : '사진 1장 = 옷 1벌'}
          </S.HeadingCount>
        </S.Heading>
        {acceptedPhotos.length === 0 ? (
          <S.Empty>등록할 수 있는 사진이 없어요</S.Empty>
        ) : (
          <S.Grid>
            {acceptedPhotos.map((photo) => (
              <li key={photo.id}>
                <PhotoTile
                  fileName={photo.file.name}
                  previewUrl={photo.previewUrl}
                  state={getTileState(photo.id)}
                  onToggle={() => togglePhoto(photo.id)}
                />
              </li>
            ))}
          </S.Grid>
        )}
      </S.Body>
      <ExcludedPhotosSheet
        isOpen={isExcludedSheetOpen}
        onOpenChange={setIsExcludedSheetOpen}
        photos={excludedPhotos}
      />
    </FullScreenDialog>
  );
};

export default PhotoConfirmDialog;
