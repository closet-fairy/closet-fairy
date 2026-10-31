import OutfitItemImage from '@/components/OutfitItemImage';
import { CLOTHING_CATEGORY_LABEL } from '@/constants/clothingAttribute';
import type { RecommendationHistoryOutfitItem } from '@/generated/models';
import * as S from './HistoryItemGrid.styled';

interface HistoryItemGridProps {
  items: readonly RecommendationHistoryOutfitItem[];
}

const SLOT_LABEL = { ...CLOTHING_CATEGORY_LABEL, outer: '겉옷' };

const HistoryItemGrid = (props: HistoryItemGridProps) => {
  const { items } = props;

  return (
    <S.Grid>
      {items.map((item, itemIndex) => (
        // 같은 옷이 두 번 올 수 없지만 고유 번호가 없어 이름과 순서로 구분한다.
        <li key={`${item.item_name}-${itemIndex}`}>
          <OutfitItemImage
            item={item}
            size="lg"
            isDeleted={item.is_clothing_deleted}
          />
          <S.Name $isDeleted={item.is_clothing_deleted}>
            {item.item_name}
          </S.Name>
          <S.Slot>{SLOT_LABEL[item.slot_cd]}</S.Slot>
        </li>
      ))}
    </S.Grid>
  );
};

export default HistoryItemGrid;
