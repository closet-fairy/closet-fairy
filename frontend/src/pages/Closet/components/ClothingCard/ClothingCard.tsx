import { useState } from 'react';
import Icon from '@/components/common/Icon';
import Tag from '@/components/common/Tag';
import type { ClothingCard as ClothingCardData } from '@/generated/models';
import { CLOTHING_CATEGORY_LABEL } from '@/constants/clothingAttribute';
import * as S from './ClothingCard.styled';

interface ClothingCardProps {
  clothing: ClothingCardData;
  isRetrying: boolean;
  onShowStatus: () => void;
  onRetry: () => void;
}

const ClothingCard = (props: ClothingCardProps) => {
  const { clothing, isRetrying, onShowStatus, onRetry } = props;
  const [brokenImageUrl, setBrokenImageUrl] = useState<string | null>(null);
  const isImageBroken = brokenImageUrl === clothing.image_url;
  const isProcessing = clothing.processing_status_cd === 'processing';
  const isFailed = clothing.processing_status_cd === 'failed';

  const image = isImageBroken ? (
    <S.Placeholder>
      <Icon name="image" size="lg" label="사진을 불러오지 못했어요" />
    </S.Placeholder>
  ) : (
    <S.Image
      src={clothing.image_url}
      alt=""
      loading="lazy"
      $isDimmed={isProcessing}
      onError={() => setBrokenImageUrl(clothing.image_url)}
    />
  );

  if (isProcessing) {
    const label = clothing.is_queued ? '대기 중' : '처리 중';

    return (
      <S.Container>
        <S.StatusButton
          type="button"
          aria-label={`${label}인 옷`}
          aria-haspopup="dialog"
          onClick={onShowStatus}
        />
        <S.ImageBox $tone="processing">
          {image}
          <S.Overlay>
            <S.StatusBadge $isQueued={clothing.is_queued}>
              <Icon
                name={clothing.is_queued ? 'schedule' : 'progress_activity'}
                size="md"
              />
            </S.StatusBadge>
            <S.StatusLabel $isQueued={clothing.is_queued}>
              {label}
            </S.StatusLabel>
          </S.Overlay>
        </S.ImageBox>
        <S.Caption />
      </S.Container>
    );
  }

  if (isFailed) {
    return (
      <S.Container>
        <S.StatusButton
          type="button"
          aria-label="등록에 실패한 옷"
          aria-haspopup="dialog"
          onClick={onShowStatus}
        />
        <S.ImageBox $tone="failed">
          <S.Overlay>
            <S.FailedIcon>
              <Icon name="error-fill" size="md" />
            </S.FailedIcon>
            <S.StatusLabel $isQueued={false}>등록 실패</S.StatusLabel>
            <S.RetryButton
              type="button"
              disabled={isRetrying}
              onClick={onRetry}
            >
              <Icon name="refresh" size="xs" />
              재시도
            </S.RetryButton>
          </S.Overlay>
        </S.ImageBox>
        <S.Caption>
          <S.FailedTitle>배경 제거 실패</S.FailedTitle>
          <S.FailedHint>누르면 사유 확인</S.FailedHint>
        </S.Caption>
      </S.Container>
    );
  }

  const categoryLabel =
    clothing.category_cd === null
      ? null
      : CLOTHING_CATEGORY_LABEL[clothing.category_cd];

  return (
    <S.Container>
      <S.DetailLink
        to="/closet/$clothingId"
        params={{ clothingId: clothing.clothing_id }}
        aria-label={clothing.item_name ?? '이름 없음'}
      />
      <S.ImageBox $tone="default">
        {image}
        {clothing.is_new && (
          <S.NewTag>
            <Tag variant="inverse" size="xs">
              신규
            </Tag>
          </S.NewTag>
        )}
      </S.ImageBox>
      <S.Caption>
        <S.Name $isEmpty={clothing.item_name === null}>
          {clothing.item_name ?? '이름 없음'}
        </S.Name>
        <S.Category $isEmpty={categoryLabel === null}>
          {categoryLabel ?? '분류 없음'}
        </S.Category>
      </S.Caption>
    </S.Container>
  );
};

export default ClothingCard;
