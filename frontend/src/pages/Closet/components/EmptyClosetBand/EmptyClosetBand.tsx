import Icon from '@/components/common/Icon';
import * as S from './EmptyClosetBand.styled';

interface EmptyClosetBandProps {
  onClick: () => void;
}

const EmptyClosetBand = (props: EmptyClosetBandProps) => {
  const { onClick } = props;

  return (
    <S.Container>
      <S.Band type="button" aria-haspopup="dialog" onClick={onClick}>
        <S.IconWrapper>
          <Icon name="checkroom" size="xl" />
        </S.IconWrapper>
        <S.Texts>
          <S.Title>옷장이 비어 있어요</S.Title>
          <S.Description>+를 눌러 첫 옷을 등록해 보세요</S.Description>
        </S.Texts>
      </S.Band>
    </S.Container>
  );
};

export default EmptyClosetBand;
