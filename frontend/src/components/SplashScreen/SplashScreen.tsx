import AppBrand from '@/components/AppBrand';
import * as S from './SplashScreen.styled';

const SplashScreen = () => {
  return (
    <S.Container role="status" aria-busy aria-label="불러오는 중">
      <AppBrand />
    </S.Container>
  );
};

export default SplashScreen;
