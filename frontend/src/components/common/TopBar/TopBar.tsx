import type { ReactNode } from 'react';
import * as S from './TopBar.styled';

interface TopBarProps {
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

const TopBar = (props: TopBarProps) => {
  const { title, leading, trailing } = props;
  const hasLeading = Boolean(leading);
  const hasTrailing = Boolean(trailing);

  return (
    <S.Container>
      <S.Inner>
        {hasLeading && <S.Leading>{leading}</S.Leading>}
        {title && <S.Title $hasLeading={hasLeading}>{title}</S.Title>}
        {hasTrailing && <S.Trailing>{trailing}</S.Trailing>}
      </S.Inner>
    </S.Container>
  );
};

export default TopBar;
