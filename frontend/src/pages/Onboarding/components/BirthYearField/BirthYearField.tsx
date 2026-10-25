import { useId } from 'react';
import Icon from '@/components/common/Icon';
import Picker from '@/components/common/Picker';
import { createBirthYearOptions, getKstYear } from '@/domains/member/birthYear';
import * as S from './BirthYearField.styled';

const AGE_GUIDE = '만 14세 이상만 이용할 수 있어요.';

interface BirthYearFieldProps {
  value: number | null;
  onChange: (value: number) => void;
  errorMessage?: string;
}

const BirthYearField = (props: BirthYearFieldProps) => {
  const { value, onChange, errorMessage } = props;
  const messageId = useId();
  const options = createBirthYearOptions(getKstYear(new Date())).map(
    (year) => ({ value: String(year), label: `${year}년` }),
  );

  return (
    <S.Container>
      <Picker
        label="출생연도"
        placeholder="선택해 주세요"
        options={options}
        value={value === null ? null : String(value)}
        onChange={(nextValue) => onChange(Number(nextValue))}
        isInvalid={errorMessage !== undefined}
        aria-describedby={messageId}
      />
      {errorMessage === undefined ? (
        <S.Guide id={messageId}>{AGE_GUIDE}</S.Guide>
      ) : (
        <S.ErrorMessage id={messageId} role="alert">
          <Icon name="error" size="xs" />
          {errorMessage}
        </S.ErrorMessage>
      )}
    </S.Container>
  );
};

export default BirthYearField;
