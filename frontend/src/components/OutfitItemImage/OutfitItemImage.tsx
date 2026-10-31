import { useState } from 'react';
import Icon from '@/components/common/Icon';
import type { IconSize } from '@/components/common/Icon/Icon';
import Tag from '@/components/common/Tag';
import type { OutfitItemResult } from '@/generated/models';
import * as S from './OutfitItemImage.styled';

export type OutfitItemImageSize = 'md' | 'sm';

interface OutfitItemImageProps {
  item: Pick<OutfitItemResult, 'item_name' | 'item_source_cd' | 'image_url'>;
  size?: OutfitItemImageSize;
}

const FAILED_ICON_SIZE: Record<OutfitItemImageSize, IconSize> = {
  md: 'lg',
  sm: 'md',
};

const OutfitItemImage = (props: OutfitItemImageProps) => {
  const { item, size = 'md' } = props;
  const { item_name: name, image_url: imageUrl } = item;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // 큰 칸은 칸 아래에 이름이 함께 보이므로 화면 낭독기가 두 번 읽지 않게 한다.
  const imageLabel = size === 'sm' ? name : undefined;

  const renderContent = () => {
    if (imageUrl === null) {
      return <S.Name>{name}</S.Name>;
    }

    if (imageUrl === failedUrl) {
      return (
        <S.FailedIcon>
          <Icon name="image" size={FAILED_ICON_SIZE[size]} label={imageLabel} />
        </S.FailedIcon>
      );
    }

    return (
      <S.Image
        src={imageUrl}
        alt={imageLabel ?? ''}
        draggable={false}
        $size={size}
        onError={() => setFailedUrl(imageUrl)}
      />
    );
  };

  return (
    <S.Container $size={size} $isDashed={imageUrl === null}>
      {renderContent()}
      {size === 'md' && item.item_source_cd === 'essential' && (
        <S.Badge>
          <Tag variant="inverse" size="xs">
            기본
          </Tag>
        </S.Badge>
      )}
    </S.Container>
  );
};

export default OutfitItemImage;
