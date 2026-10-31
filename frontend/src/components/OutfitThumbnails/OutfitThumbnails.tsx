import type { ComponentProps } from 'react';
import OutfitItemImage from '@/components/OutfitItemImage';
import * as S from './OutfitThumbnails.styled';

interface OutfitThumbnailsProps {
  items: readonly ComponentProps<typeof OutfitItemImage>['item'][];
  hiddenCount: number;
}

const OutfitThumbnails = (props: OutfitThumbnailsProps) => {
  const { items, hiddenCount } = props;

  return (
    <S.Container>
      {items.map((item, itemIndex) => (
        // 같은 옷이 두 번 올 수 없지만 고유 번호가 없어 이름과 순서로 구분한다.
        <OutfitItemImage
          key={`${item.item_name}-${itemIndex}`}
          item={item}
          size="sm"
        />
      ))}
      {hiddenCount > 0 && <S.HiddenCount>+{hiddenCount}</S.HiddenCount>}
    </S.Container>
  );
};

export default OutfitThumbnails;
