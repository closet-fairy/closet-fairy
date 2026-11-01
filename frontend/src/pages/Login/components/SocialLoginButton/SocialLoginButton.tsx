import googleLogo from '@/assets/images/googleG.png';
import kakaoSymbol from '@/assets/images/kakaoSymbol.svg';
import type { ProviderCd } from '@/domains/member/memberSettingOptions';
import * as S from './SocialLoginButton.styled';

interface SocialLoginButtonProps {
  provider: ProviderCd;
  isDisabled?: boolean;
  onClick: () => void;
}

const LABEL: Record<ProviderCd, string> = {
  google: 'Google로 로그인',
  kakao: '카카오 로그인',
};

const LOGO: Record<ProviderCd, string> = {
  google: googleLogo,
  kakao: kakaoSymbol,
};

const SocialLoginButton = (props: SocialLoginButtonProps) => {
  const { provider, isDisabled = false, onClick } = props;

  return (
    <S.Button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      $provider={provider}
    >
      <S.Logo src={LOGO[provider]} alt="" $provider={provider} />
      {LABEL[provider]}
    </S.Button>
  );
};

export default SocialLoginButton;
