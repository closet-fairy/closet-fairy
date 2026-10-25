import { useState } from 'react';
import Button from '@/components/common/Button';
import IconButton from '@/components/common/IconButton';
import TopBar from '@/components/common/TopBar';
import StylePreferenceList from '@/components/StylePreferenceList';
import type { StyleCd } from '@/domains/member/memberSettingOptions';
import * as S from './StyleSelectView.styled';

interface StyleSelectViewProps {
  initialValue: StyleCd[];
  onBack: () => void;
  onDone: (value: StyleCd[]) => void;
}

const StyleSelectView = (props: StyleSelectViewProps) => {
  const { initialValue, onBack, onDone } = props;
  const [styles, setStyles] = useState(initialValue);

  return (
    <S.Container>
      <TopBar
        title="선호 스타일"
        leading={
          <IconButton
            icon="arrow_back"
            aria-label="뒤로 가기"
            onClick={onBack}
          />
        }
        trailing={<S.Count aria-live="polite">{styles.length}개 선택</S.Count>}
      />
      <S.Body>
        <StylePreferenceList
          aria-label="선호 스타일"
          value={styles}
          onChange={setStyles}
        />
      </S.Body>
      <S.Footer>
        <Button isFullWidth onClick={() => onDone(styles)}>
          완료
        </Button>
      </S.Footer>
    </S.Container>
  );
};

export default StyleSelectView;
