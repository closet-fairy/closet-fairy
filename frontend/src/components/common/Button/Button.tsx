import type { MouseEventHandler, ReactNode, Ref } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import type { IconSize } from '@/components/common/Icon/Icon';
import * as S from './Button.styled';

export type ButtonVariant = 'primary' | 'outline' | 'text';
export type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  isFullWidth?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
  id?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean | 'mixed';
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-controls'?: string;
  'aria-describedby'?: string;
}

const ICON_SIZE: Record<ButtonSize, IconSize> = {
  lg: 'md',
  md: 'sm',
  sm: 'xs',
};

const Button = (props: ButtonProps) => {
  const {
    children,
    variant = 'primary',
    size = 'lg',
    icon,
    isFullWidth = false,
    isDisabled = false,
    isLoading = false,
    type = 'button',
    onClick,
    ref,
    id,
    'aria-label': ariaLabel,
    'aria-expanded': ariaExpanded,
    'aria-pressed': ariaPressed,
    'aria-haspopup': ariaHasPopup,
    'aria-controls': ariaControls,
    'aria-describedby': ariaDescribedBy,
  } = props;

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (isLoading) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  };

  return (
    <S.Button
      ref={ref}
      type={type}
      disabled={isDisabled}
      onClick={handleClick}
      id={id}
      aria-busy={isLoading || undefined}
      aria-disabled={isLoading || undefined}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      aria-haspopup={ariaHasPopup}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedBy}
      $variant={variant}
      $size={size}
      $isFullWidth={isFullWidth}
    >
      <S.Content $isHidden={isLoading}>
        {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
        <S.Label>{children}</S.Label>
      </S.Content>
      {isLoading && (
        <S.Spinner aria-hidden>
          <Icon name="progress_activity" size={ICON_SIZE[size]} />
        </S.Spinner>
      )}
    </S.Button>
  );
};

export default Button;
