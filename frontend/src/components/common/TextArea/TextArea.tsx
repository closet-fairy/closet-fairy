import type { ChangeEvent, Ref } from 'react';
import { useId } from 'react';
import * as S from './TextArea.styled';

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  errorMessage?: string;
  isDisabled?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
  'aria-label'?: string;
}

const TextArea = (props: TextAreaProps) => {
  const {
    value,
    onChange,
    placeholder,
    maxLength,
    errorMessage,
    isDisabled = false,
    ref,
    'aria-label': ariaLabel,
  } = props;
  const errorId = useId();
  const counterId = useId();

  const hasError = errorMessage !== undefined && errorMessage !== '';
  const hasCounter = maxLength !== undefined;
  const length = [...value].length;
  const isOverLimit = hasCounter && length > maxLength;
  const describedBy = [hasError ? errorId : '', hasCounter ? counterId : '']
    .filter((describedById) => describedById !== '')
    .join(' ');

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <S.Container>
      <S.Field $hasError={hasError} $isDisabled={isDisabled}>
        <S.Input
          ref={ref}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={isDisabled}
          aria-label={ariaLabel}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
        />
        {hasCounter && (
          <S.Counter id={counterId} $isOverLimit={isOverLimit}>
            {length} / {maxLength}
          </S.Counter>
        )}
      </S.Field>
      {hasError && (
        <S.ErrorMessage id={errorId} role="alert">
          {errorMessage}
        </S.ErrorMessage>
      )}
    </S.Container>
  );
};

export default TextArea;
