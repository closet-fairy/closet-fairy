import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import * as S from './SaveErrorBanner.styled';

interface SaveErrorBannerProps {
  message: string;
  isDisabled?: boolean;
  onRetry: () => void;
}

const SaveErrorBanner = (props: SaveErrorBannerProps) => {
  const { message, isDisabled = false, onRetry } = props;

  return (
    <S.Container>
      <S.Banner>
        <S.IconWrapper>
          <Icon name="error" />
        </S.IconWrapper>
        <S.Message role="alert">{message}</S.Message>
        <Button
          variant="outline"
          size="sm"
          isDisabled={isDisabled}
          onClick={onRetry}
        >
          다시 시도
        </Button>
      </S.Banner>
    </S.Container>
  );
};

export default SaveErrorBanner;
