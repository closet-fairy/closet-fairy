import type { ReactNode } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './Notice.styled';

export type NoticeVariant = 'banner' | 'subtle';

interface NoticeProps {
  variant?: NoticeVariant;
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

const Notice = (props: NoticeProps) => {
  const { variant = 'banner', icon, title, description, action } = props;
  const hasAction = Boolean(action);

  return (
    <S.Container $variant={variant}>
      <S.Main>
        {icon && (
          <S.IconWrapper $variant={variant}>
            <Icon name={icon} size="sm" />
          </S.IconWrapper>
        )}
        <S.Text>
          <S.Title $variant={variant}>{title}</S.Title>
          {description && (
            <S.Description $variant={variant}>{description}</S.Description>
          )}
        </S.Text>
      </S.Main>
      {hasAction && <S.Action>{action}</S.Action>}
    </S.Container>
  );
};

export default Notice;
