import type { Ref } from 'react';
import Icon from '@/components/common/Icon';
import * as S from './OutfitActions.styled';

interface OutfitActionsProps {
  infoButtonRef?: Ref<HTMLButtonElement>;
  onInfoClick: () => void;
}

const OutfitActions = (props: OutfitActionsProps) => {
  const { infoButtonRef, onInfoClick } = props;

  return (
    <S.Container>
      <S.Action ref={infoButtonRef} type="button" onClick={onInfoClick}>
        <S.Circle $variant="sub">
          <Icon name="scroll_text" size="lg" />
        </S.Circle>
        <S.Label $variant="sub">정보 확인</S.Label>
      </S.Action>
      <S.Action type="button">
        <S.Circle $variant="main">
          <Icon name="check" size="xl" />
        </S.Circle>
        <S.Label $variant="main">채택하기</S.Label>
      </S.Action>
      <S.Action type="button">
        <S.Circle $variant="sub">
          <Icon name="edit" size="lg" />
        </S.Circle>
        <S.Label $variant="sub">수정 요청하기</S.Label>
      </S.Action>
    </S.Container>
  );
};

export default OutfitActions;
