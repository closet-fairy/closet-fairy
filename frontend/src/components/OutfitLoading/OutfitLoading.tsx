import Icon from '@/components/common/Icon';
import * as S from './OutfitLoading.styled';

interface OutfitLoadingProps {
  label?: string;
}

const OutfitLoading = (props: OutfitLoadingProps) => {
  const { label = '코디를 불러오는 중이에요' } = props;

  return (
    <S.Container role="status">
      <S.Spinner>
        <Icon name="progress_activity" size="xl" />
      </S.Spinner>
      <S.Text>{label}</S.Text>
    </S.Container>
  );
};

export default OutfitLoading;
