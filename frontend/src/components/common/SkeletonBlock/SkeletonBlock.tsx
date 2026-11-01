import * as S from './SkeletonBlock.styled';

export type SkeletonBlockTone = 'light' | 'soft';

interface SkeletonBlockProps {
  tone?: SkeletonBlockTone;
  className?: string;
}

const SkeletonBlock = (props: SkeletonBlockProps) => {
  const { tone = 'soft', className } = props;

  return <S.Container className={className} $tone={tone} />;
};

export default SkeletonBlock;
