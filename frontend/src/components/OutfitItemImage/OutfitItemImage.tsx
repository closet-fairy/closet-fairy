import Tag from '@/components/common/Tag';
import type { OutfitItemResult } from '@/generated/models';
import * as S from './OutfitItemImage.styled';

export type OutfitItemImageSize = 'md' | 'sm';

interface OutfitItemImageProps {
  item: Pick<OutfitItemResult, 'item_name' | 'item_source_cd' | 'image_url'>;
  size?: OutfitItemImageSize;
}

const OutfitItemImage = (props: OutfitItemImageProps) => {
  const { item, size = 'md' } = props;
  const { item_name: name, image_url: imageUrl } = item;

  return (
    <S.Container $size={size} $isDashed={imageUrl === null}>
      {imageUrl === null ? (
        <S.Name>{name}</S.Name>
      ) : (
        <S.Image
          src={imageUrl}
          // 큰 칸은 칸 아래에 이름이 함께 보이므로 화면 낭독기가 두 번 읽지 않게 한다.
          alt={size === 'sm' ? name : ''}
          draggable={false}
          $size={size}
        />
      )}
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
