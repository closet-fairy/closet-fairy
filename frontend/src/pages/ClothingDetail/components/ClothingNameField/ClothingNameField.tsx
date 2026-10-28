import { useState } from 'react';
import TextField from '@/components/common/TextField';
import { clothingUpdateItemNameOneMax } from '@/generated/models';
import * as S from './ClothingNameField.styled';

interface ClothingNameFieldProps {
  name: string | null;
  errorMessage?: string;
  onSave: (name: string | null) => void;
}

// BE가 저장할 때와 같이 앞뒤 공백을 지우고 사이의 공백을 하나로 줄인다.
const normalizeName = (draft: string) =>
  draft.split(/\s+/).filter(Boolean).join(' ');

const ClothingNameField = (props: ClothingNameFieldProps) => {
  const { name, errorMessage, onSave } = props;
  const [draft, setDraft] = useState(name ?? '');

  const commit = () => {
    const normalized = normalizeName(draft);

    // 글자 수를 넘기면 입력칸의 글자 수 표시가 알리므로 보내지 않는다.
    if (normalized.length > clothingUpdateItemNameOneMax) {
      return;
    }

    setDraft(normalized);
    const nextName = normalized === '' ? null : normalized;

    // 저장하지 못한 채라면 같은 이름이어도 다시 보내 실패 문구를 걷을 수 있게 한다.
    if (nextName !== name || errorMessage !== undefined) {
      onSave(nextName);
    }
  };

  return (
    <S.Row>
      <S.Label htmlFor="clothing-name">옷 이름</S.Label>
      <S.Field>
        <TextField
          id="clothing-name"
          value={draft}
          onChange={setDraft}
          placeholder="옷 이름을 입력해 주세요"
          maxLength={clothingUpdateItemNameOneMax}
          hasClearButton
          enterKeyHint="done"
          errorMessage={errorMessage}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.currentTarget.blur();
            }
          }}
        />
      </S.Field>
    </S.Row>
  );
};

export default ClothingNameField;
