import { useContext, useId } from 'react';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import * as S from './PickerTrigger.styled';

interface PickerTriggerProps {
  label: string;
  valueText?: string;
  placeholder?: string;
  isExpanded: boolean;
  onClick: () => void;
  isDisabled?: boolean;
  isInvalid?: boolean;
  'aria-describedby'?: string;
}

const PickerTrigger = (props: PickerTriggerProps) => {
  const {
    label,
    valueText,
    placeholder,
    isExpanded,
    onClick,
    isDisabled = false,
    isInvalid = false,
    'aria-describedby': ariaDescribedBy,
  } = props;
  const formField = useContext(FormFieldContext);
  const captionId = useId();
  const displayTextId = useId();

  const displayText = valueText ?? placeholder;
  const labelledBy = [
    formField?.labelId,
    captionId,
    displayText ? displayTextId : undefined,
  ]
    .filter((id) => id !== undefined)
    .join(' ');
  const describedBy = [formField?.hintId, ariaDescribedBy]
    .filter((id) => id !== undefined)
    .join(' ');

  return (
    <S.Trigger
      type="button"
      aria-haspopup="dialog"
      aria-expanded={isExpanded}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy === '' ? undefined : describedBy}
      aria-invalid={isInvalid || undefined}
      disabled={isDisabled}
      onClick={onClick}
      $isInvalid={isInvalid}
    >
      <S.Caption id={captionId}>{label}</S.Caption>
      {valueText !== undefined ? (
        <S.Value id={displayTextId}>{valueText}</S.Value>
      ) : (
        placeholder && (
          <S.Placeholder id={displayTextId}>{placeholder}</S.Placeholder>
        )
      )}
    </S.Trigger>
  );
};

export default PickerTrigger;
