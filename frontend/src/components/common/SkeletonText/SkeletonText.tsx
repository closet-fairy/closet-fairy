import type { SerializedStyles } from '@emotion/react';
import * as S from './SkeletonText.styled';

interface SkeletonTextProps {
  textStyle: SerializedStyles;
  width?: string;
  className?: string;
}

const SkeletonText = (props: SkeletonTextProps) => {
  const { textStyle, width = '100%', className } = props;

  return (
    <S.Line className={className} $textStyle={textStyle}>
      <S.Bar $width={width} />
    </S.Line>
  );
};

export default SkeletonText;
