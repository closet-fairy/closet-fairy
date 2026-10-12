import type { ReactNode } from 'react';
import { useContext } from 'react';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import * as S from './ChipGroup.styled';

interface ChipGroupProps {
  value: string | null;
  onChange: (value: string) => void;
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  isDisabled?: boolean;
}

const ChipGroup = (props: ChipGroupProps) => {
  const {
    value,
    onChange,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    isDisabled = false,
  } = props;

  const formField = useContext(FormFieldContext);

  const handleValueChange = (groupValue: string[]) => {
    const nextValue = groupValue.at(0);

    if (nextValue === undefined) {
      return;
    }

    onChange(nextValue);
  };

  return (
    <S.Container
      value={value === null ? [] : [value]}
      onValueChange={handleValueChange}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-labelledby={
        ariaLabelledBy ??
        (ariaLabel === undefined ? formField?.labelId : undefined)
      }
      aria-describedby={formField?.hintId}
    >
      {children}
    </S.Container>
  );
};

export default ChipGroup;
