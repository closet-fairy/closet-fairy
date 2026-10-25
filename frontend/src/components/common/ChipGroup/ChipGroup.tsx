import type { ReactNode } from 'react';
import { useContext } from 'react';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import * as S from './ChipGroup.styled';

interface ChipGroupBaseProps {
  value: string | null;
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  isDisabled?: boolean;
}

interface RequiredChipGroupProps extends ChipGroupBaseProps {
  isDeselectable?: false;
  onChange: (value: string) => void;
}

interface DeselectableChipGroupProps extends ChipGroupBaseProps {
  isDeselectable: true;
  onChange: (value: string | null) => void;
}

type ChipGroupProps = RequiredChipGroupProps | DeselectableChipGroupProps;

const ChipGroup = (props: ChipGroupProps) => {
  const {
    value,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    isDisabled = false,
    isDeselectable,
    onChange,
  } = props;

  const formField = useContext(FormFieldContext);

  const handleValueChange = (groupValue: string[]) => {
    const nextValue = groupValue.at(0);

    if (nextValue !== undefined) {
      onChange(nextValue);
      return;
    }

    if (isDeselectable === true) {
      onChange(null);
    }
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
