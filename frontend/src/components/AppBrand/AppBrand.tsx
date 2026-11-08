import appLogoUrl from '@/assets/images/appLogo.webp';
import { LOGO_HEIGHT, LOGO_WIDTH } from './AppBrand.constants';
import * as S from './AppBrand.styled';

const AppBrand = () => {
  return (
    <S.Container>
      <S.Logo
        src={appLogoUrl}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        alt=""
        aria-hidden
      />
      <S.Text>
        <S.Name>옷장요정</S.Name>
        <S.Tagline>내 옷으로 오늘 입을 옷을 골라드려요</S.Tagline>
      </S.Text>
    </S.Container>
  );
};

export default AppBrand;
