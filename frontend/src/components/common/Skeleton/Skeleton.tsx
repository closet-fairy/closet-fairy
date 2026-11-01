import type { ReactNode } from 'react';
import * as S from './Skeleton.styled';

interface SkeletonProps {
  delay?: number;
  className?: string;
  children: ReactNode;
}

const Skeleton = (props: SkeletonProps) => {
  const { delay = 0, className, children } = props;

  return (
    <S.Container className={className} $delay={delay} aria-hidden="true">
      {children}
    </S.Container>
  );
};

export default Skeleton;
