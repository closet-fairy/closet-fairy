import Icon from '@/components/common/Icon';
import * as S from './OutfitLoading.styled';

const OutfitLoading = () => (
  <S.Container role="status">
    <S.Spinner>
      <Icon name="progress_activity" size="xl" />
    </S.Spinner>
    <S.Text>코디를 불러오는 중이에요</S.Text>
  </S.Container>
);

export default OutfitLoading;
