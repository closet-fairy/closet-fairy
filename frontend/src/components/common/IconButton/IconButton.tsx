import type { MouseEventHandler, Ref } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import type { IconSize } from '@/components/common/Icon/Icon';
import * as S from './IconButton.styled';

export type IconButtonVariant = 'plain' | 'circle';

interface IconButtonProps {
  icon: IconName;
  'aria-label': string;
  variant?: IconButtonVariant;
  iconSize?: IconSize;
  isDisabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
  id?: string;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean | 'mixed';
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-controls'?: string;
  'aria-describedby'?: string;
}

const IconButton = (props: IconButtonProps) => {
  const {
    icon,
    'aria-label': ariaLabel,
    variant = 'plain',
    iconSize = 'lg',
    isDisabled = false,
    onClick,
    ref,
    id,
    'aria-expanded': ariaExpanded,
    'aria-pressed': ariaPressed,
    'aria-haspopup': ariaHasPopup,
    'aria-controls': ariaControls,
    'aria-describedby': ariaDescribedBy,
  } = props;

  return (
    <S.Button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      disabled={isDisabled}
      onClick={onClick}
      id={id}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      aria-haspopup={ariaHasPopup}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedBy}
      $variant={variant}
    >
      <Icon name={icon} size={iconSize} />
    </S.Button>
  );
};

export default IconButton;
