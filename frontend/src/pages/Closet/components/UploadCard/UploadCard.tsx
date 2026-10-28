import { useState } from 'react';
import Icon from '@/components/common/Icon';
import type { ClothingUpload } from '@/pages/Closet/clothingUploadStore';
import * as S from './UploadCard.styled';

interface UploadCardProps {
  upload: ClothingUpload;
  onResend: () => void;
  onDismiss: () => void;
}

const UploadCard = (props: UploadCardProps) => {
  const { upload, onResend, onDismiss } = props;
  // HEIC처럼 브라우저가 그리지 못하는 사진은 파일 이름으로 어느 사진인지 알린다.
  const [isPreviewBroken, setIsPreviewBroken] = useState(false);

  if (upload.status === 'failed') {
    return (
      <div>
        <S.ImageBox $isFailed>
          <S.Overlay>
            <S.FailedIcon>
              <Icon name="sync_problem" size="md" />
            </S.FailedIcon>
            <S.StatusLabel>올리기 실패</S.StatusLabel>
            <S.ResendButton type="button" onClick={onResend}>
              다시 보내기
            </S.ResendButton>
          </S.Overlay>
          <S.DismissButton
            type="button"
            aria-label="올리기 실패한 사진 치우기"
            onClick={onDismiss}
          >
            <Icon name="close" size="sm" />
          </S.DismissButton>
        </S.ImageBox>
        <S.Caption>
          <S.ErrorMessage>{upload.errorMessage}</S.ErrorMessage>
        </S.Caption>
      </div>
    );
  }

  return (
    <div>
      <S.ImageBox $isFailed={false}>
        {isPreviewBroken ? (
          <S.Placeholder>
            <S.PlaceholderName>{upload.file.name}</S.PlaceholderName>
          </S.Placeholder>
        ) : (
          <S.Image
            src={upload.previewUrl}
            alt=""
            onError={() => setIsPreviewBroken(true)}
          />
        )}
        <S.Overlay>
          <S.StatusBadge>
            <Icon name="progress_activity" size="md" />
          </S.StatusBadge>
          <S.StatusLabel>처리 중</S.StatusLabel>
        </S.Overlay>
      </S.ImageBox>
      <S.Caption />
    </div>
  );
};

export default UploadCard;
