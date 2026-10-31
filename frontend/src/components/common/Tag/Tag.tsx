import type { ReactNode } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './Tag.styled';

export type TagVariant = 'neutral' | 'inverse' | 'outline' | 'white';
export type TagSize = 'xs' | 'sm' | 'md';

interface TagProps {
  children: ReactNode;
  variant?: TagVariant;
  size?: TagSize;
  icon?: IconName;
}

const Tag = (props: TagProps) => {
  const { children, variant = 'neutral', size = 'md', icon } = props;

  return (
    <S.Container $variant={variant} $size={size}>
      {icon && <Icon name={icon} size="xs" />}
      <S.Label>{children}</S.Label>
    </S.Container>
  );
};

export default Tag;
