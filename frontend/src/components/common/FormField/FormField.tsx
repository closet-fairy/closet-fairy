import type { ReactNode } from 'react';
import { useId } from 'react';
import { FormFieldContext } from './FormField.context';
import * as S from './FormField.styled';

interface FormFieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}

const FormField = (props: FormFieldProps) => {
  const { label, hint, htmlFor, children } = props;

  const labelId = useId();
  const hintId = useId();

  return (
    <FormFieldContext value={{ labelId, hintId: hint ? hintId : undefined }}>
      <S.Container>
        <S.Header>
          {htmlFor === undefined ? (
            <S.LabelText id={labelId}>{label}</S.LabelText>
          ) : (
            <S.Label id={labelId} htmlFor={htmlFor}>
              {label}
            </S.Label>
          )}
          {hint && <S.Hint id={hintId}>{hint}</S.Hint>}
        </S.Header>
        {children}
      </S.Container>
    </FormFieldContext>
  );
};

export default FormField;
