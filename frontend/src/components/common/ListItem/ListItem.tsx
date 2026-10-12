import type { MouseEvent } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './ListItem.styled';

export type ListItemVariant = 'plain' | 'card';

interface ListItemProps {
  variant?: ListItemVariant;
  icon?: IconName;
  title: string;
  description?: string;
  hasChevron?: boolean;
  isDisabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

const ListItem = (props: ListItemProps) => {
  const {
    variant = 'plain',
    icon,
    title,
    description,
    hasChevron = false,
    isDisabled = false,
    onClick,
  } = props;

  const content = (
    <>
      {icon && (
        <S.LeadingIcon $variant={variant}>
          <Icon name={icon} size={variant === 'card' ? 'lg' : 'md'} />
        </S.LeadingIcon>
      )}
      <S.Text>
        <S.Title $variant={variant}>{title}</S.Title>
        {description && <S.Description>{description}</S.Description>}
      </S.Text>
      {hasChevron && (
        <S.Chevron>
          <Icon name="chevron_right" size="md" />
        </S.Chevron>
      )}
    </>
  );

  if (onClick) {
    return (
      <S.ButtonContainer
        type="button"
        $variant={variant}
        disabled={isDisabled}
        onClick={onClick}
      >
        {content}
      </S.ButtonContainer>
    );
  }

  return (
    <S.Container $variant={variant} $isDisabled={isDisabled}>
      {content}
    </S.Container>
  );
};

export default ListItem;
