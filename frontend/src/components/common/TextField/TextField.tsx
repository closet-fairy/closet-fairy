import type {
  ChangeEvent,
  FocusEvent,
  FocusEventHandler,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEventHandler,
  Ref,
} from 'react';
import { useContext, useId, useRef } from 'react';
import type { IconName } from '@/assets/icons';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import Icon from '@/components/common/Icon';
import * as S from './TextField.styled';

type TextFieldType = 'text' | 'search' | 'tel' | 'email' | 'url';

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: IconName;
  hasClearButton?: boolean;
  onClear?: () => void;
  maxLength?: number;
  errorMessage?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  type?: TextFieldType;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  ref?: Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  enterKeyHint?: HTMLAttributes<HTMLInputElement>['enterKeyHint'];
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
  autoFocus?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

const TextField = (props: TextFieldProps) => {
  const {
    value,
    onChange,
    placeholder,
    icon,
    hasClearButton = false,
    onClear,
    maxLength,
    errorMessage,
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    type = 'text',
    onBlur,
    onFocus,
    onKeyDown,
    ref,
    id,
    name,
    inputMode,
    enterKeyHint,
    autoComplete,
    autoFocus,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
  } = props;

  const formField = useContext(FormFieldContext);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const isRefocusingRef = useRef(false);
  const errorId = useId();
  const counterId = useId();

  const hasError = errorMessage !== undefined && errorMessage !== '';
  const hasCounter = maxLength !== undefined;
  const length = [...value].length;
  const isOverLimit = hasCounter && length > maxLength;
  const isClearVisible =
    hasClearButton && value !== '' && !isDisabled && !isReadOnly;

  const labelledBy =
    ariaLabelledBy ??
    (ariaLabel === undefined ? formField?.labelId : undefined);

  const describedBy = [
    formField?.hintId ?? '',
    ariaDescribedBy ?? '',
    hasError ? errorId : '',
    hasCounter ? counterId : '',
  ]
    .filter((describedById) => describedById !== '')
    .join(' ');

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;

    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isRefocusingRef.current) {
      return;
    }

    onChange(event.target.value);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (isRefocusingRef.current) {
      return;
    }

    onBlur?.(event);
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    if (isRefocusingRef.current) {
      return;
    }

    onFocus?.(event);
  };

  const handleClear = () => {
    const input = inputRef.current;

    if (isComposingRef.current) {
      isRefocusingRef.current = true;
      input?.blur();
      isComposingRef.current = false;
    }

    onChange('');
    input?.focus();
    isRefocusingRef.current = false;
    onClear?.();
  };

  return (
    <S.Container>
      <S.Field $hasError={hasError} $isDisabled={isDisabled}>
        {icon && (
          <S.LeadingIcon>
            <Icon name={icon} />
          </S.LeadingIcon>
        )}
        <S.Input
          ref={setInputRef}
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={onKeyDown}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          placeholder={placeholder}
          disabled={isDisabled}
          readOnly={isReadOnly}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          required={isRequired}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
        />
        {hasCounter && (
          <S.Counter id={counterId} $isOverLimit={isOverLimit}>
            {length}/{maxLength}
          </S.Counter>
        )}
        {isClearVisible && (
          <S.ClearButton
            type="button"
            aria-label="입력 지우기"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
          >
            <Icon name="cancel" />
          </S.ClearButton>
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

export default TextField;
