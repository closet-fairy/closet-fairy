import { useState } from 'react';
import TextField from '@/components/common/TextField';
import { clothingUpdateItemNameOneMax } from '@/generated/models';
import * as S from './ClothingNameField.styled';

interface ClothingNameFieldProps {
  name: string | null;
  errorMessage?: string;
  onSave: (name: string | null) => void;
}

const toSavedName = (draft: string) => {
  const trimmed = draft.trim();

  return trimmed === '' ? null : trimmed;
};

const ClothingNameField = (props: ClothingNameFieldProps) => {
  const { name, errorMessage, onSave } = props;
  const [draft, setDraft] = useState(name ?? '');

  // 입력칸을 벗어나거나 키보드의 완료를 누르면, 바뀐 경우에만 저장한다.
  const commit = (nextDraft: string) => {
    const nextName = toSavedName(nextDraft);

    if (nextName !== name) {
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
          onClear={() => {
            setDraft('');
            commit('');
          }}
          enterKeyHint="done"
          errorMessage={errorMessage}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
      </S.Field>
    </S.Row>
  );
};

export default ClothingNameField;
