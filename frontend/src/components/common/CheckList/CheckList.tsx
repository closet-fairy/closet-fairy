import { useContext, useId } from 'react';
import Icon from '@/components/common/Icon';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import * as S from './CheckList.styled';

export interface CheckListItem {
  value: string;
  label: string;
  description?: string;
}

interface CheckListProps {
  items: readonly CheckListItem[];
  value: string[];
  onChange: (value: string[]) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  isDisabled?: boolean;
}

const CheckList = (props: CheckListProps) => {
  const {
    items,
    value,
    onChange,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    isDisabled = false,
  } = props;

  const formField = useContext(FormFieldContext);
  const descriptionIdPrefix = useId();

  return (
    <S.Container
      multiple
      orientation="vertical"
      value={value}
      onValueChange={(nextValue: string[]) => onChange(nextValue)}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-labelledby={
        ariaLabelledBy ??
        (ariaLabel === undefined ? formField?.labelId : undefined)
      }
      aria-describedby={formField?.hintId}
    >
      {items.map((item, index) => {
        const isChecked = value.includes(item.value);
        const descriptionId = `${descriptionIdPrefix}-${index}`;

        return (
          <S.Item
            key={item.value}
            value={item.value}
            aria-describedby={item.description ? descriptionId : undefined}
          >
            <S.Text>
              <S.Label $isChecked={isChecked}>{item.label}</S.Label>
              {item.description && (
                <S.Description id={descriptionId} aria-hidden>
                  {item.description}
                </S.Description>
              )}
            </S.Text>
            <S.Indicator $isChecked={isChecked}>
              <Icon
                name={
                  isChecked ? 'check_circle-fill' : 'radio_button_unchecked'
                }
                size="lg"
              />
            </S.Indicator>
          </S.Item>
        );
      })}
    </S.Container>
  );
};

export default CheckList;
