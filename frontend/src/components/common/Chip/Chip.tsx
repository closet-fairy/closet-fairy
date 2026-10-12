import type { Toggle } from '@base-ui/react/toggle';
import type { ReactNode } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './Chip.styled';

export type ChipVariant = 'solid' | 'dashed';

interface ChipProps {
  value: string;
  children: ReactNode;
  trailingIcon?: IconName;
  variant?: ChipVariant;
  isDisabled?: boolean;
  onClick?: () => void;
}

const Chip = (props: ChipProps) => {
  const {
    value,
    children,
    trailingIcon,
    variant = 'solid',
    isDisabled = false,
    onClick,
  } = props;

  const handlePressedChange = (
    _pressed: boolean,
    eventDetails: Toggle.ChangeEventDetails,
  ) => {
    if (!onClick) {
      return;
    }

    eventDetails.cancel();
    onClick();
  };

  return (
    <S.Container
      value={value}
      disabled={isDisabled}
      onPressedChange={handlePressedChange}
      $variant={variant}
      $hasTrailingIcon={trailingIcon !== undefined}
    >
      <S.Label>{children}</S.Label>
      {trailingIcon && (
        <S.TrailingIcon>
          <Icon name={trailingIcon} size="xs" />
        </S.TrailingIcon>
      )}
    </S.Container>
  );
};

export default Chip;
