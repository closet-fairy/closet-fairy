import Icon from '@/components/common/Icon';
import * as S from './AppBrand.styled';

const AppBrand = () => {
  return (
    <S.Container>
      <S.LogoPlaceholder>
        <Icon name="checkroom" size="xl" />
      </S.LogoPlaceholder>
      <S.Text>
        <S.Name>옷장 요정</S.Name>
        <S.Tagline>내 옷으로 오늘 입을 옷을 골라드려요</S.Tagline>
      </S.Text>
    </S.Container>
  );
};

export default AppBrand;
