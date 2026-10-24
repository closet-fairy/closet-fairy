import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './SegmentedControl.styled';

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  isDisabled?: boolean;
}

const SegmentedControl = (props: SegmentedControlProps) => {
  const {
    options,
    value,
    onChange,
    'aria-label': ariaLabel,
    isDisabled = false,
  } = props;

  const handleValueChange = (groupValue: string[]) => {
    const nextValue = groupValue.at(0);

    if (nextValue === undefined) {
      return;
    }

    onChange(nextValue);
  };

  return (
    <S.Container
      value={[value]}
      onValueChange={handleValueChange}
      disabled={isDisabled}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <S.Segment key={option.value} value={option.value}>
          {option.icon && <Icon name={option.icon} size="sm" />}
          <S.Label>{option.label}</S.Label>
        </S.Segment>
      ))}
    </S.Container>
  );
};

export default SegmentedControl;
