import type { ReactNode } from 'react';
import { useContext } from 'react';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import * as S from './ChipGroup.styled';

interface ChipGroupBaseProps {
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  isDisabled?: boolean;
}

interface RequiredChipGroupProps extends ChipGroupBaseProps {
  isMultiple?: false;
  isDeselectable?: false;
  value: string | null;
  onChange: (value: string) => void;
}

interface DeselectableChipGroupProps extends ChipGroupBaseProps {
  isMultiple?: false;
  isDeselectable: true;
  value: string | null;
  onChange: (value: string | null) => void;
}

interface MultipleChipGroupProps extends ChipGroupBaseProps {
  isMultiple: true;
  isDeselectable?: never;
  value: string[];
  onChange: (value: string[]) => void;
}

type ChipGroupProps =
  RequiredChipGroupProps | DeselectableChipGroupProps | MultipleChipGroupProps;

const ChipGroup = (props: ChipGroupProps) => {
  const {
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    isDisabled = false,
  } = props;

  const formField = useContext(FormFieldContext);

  const handleValueChange = (groupValue: string[]) => {
    if (props.isMultiple === true) {
      props.onChange(groupValue);
      return;
    }

    const nextValue = groupValue.at(0);

    if (nextValue !== undefined) {
      props.onChange(nextValue);
      return;
    }

    if (props.isDeselectable === true) {
      props.onChange(null);
    }
  };

  const groupValue = (() => {
    if (props.isMultiple === true) {
      return props.value;
    }

    return props.value === null ? [] : [props.value];
  })();

  return (
    <S.Container
      value={groupValue}
      multiple={props.isMultiple === true}
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
