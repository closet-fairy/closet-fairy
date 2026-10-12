import type { ReactNode } from 'react';
import * as S from './StatusView.styled';

export type StatusViewVisualPlacement = 'top' | 'bottom';

interface StatusViewProps {
  visual?: ReactNode;
  visualPlacement?: StatusViewVisualPlacement;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  isBusy?: boolean;
}

const StatusView = (props: StatusViewProps) => {
  const {
    visual,
    visualPlacement = 'top',
    title,
    description,
    children,
    actions,
    isBusy = false,
  } = props;
  const hasVisual = Boolean(visual);
  const hasChildren = Boolean(children);
  const hasActions = Boolean(actions);

  return (
    <S.Container>
      <S.Body>
        {hasVisual && visualPlacement === 'top' && (
          <S.Visual>{visual}</S.Visual>
        )}
        <S.Heading role="status">
          <S.Title>{title}</S.Title>
          {description && <S.Description>{description}</S.Description>}
        </S.Heading>
        {hasVisual && visualPlacement === 'bottom' && (
          <S.Visual>{visual}</S.Visual>
        )}
        {hasChildren && <S.Content aria-busy={isBusy}>{children}</S.Content>}
      </S.Body>
      {hasActions && <S.Actions>{actions}</S.Actions>}
    </S.Container>
  );
};

export default StatusView;
