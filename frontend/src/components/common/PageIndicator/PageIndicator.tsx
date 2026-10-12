import * as S from './PageIndicator.styled';

interface PageIndicatorProps {
  count: number;
  index: number;
  isDecorative?: boolean;
}

const PageIndicator = (props: PageIndicatorProps) => {
  const { count, index, isDecorative = true } = props;
  const dots = Array.from({ length: count }, (_, dotIndex) => (
    <S.Dot key={dotIndex} $isActive={dotIndex === index} />
  ));

  if (isDecorative) {
    return <S.Container aria-hidden>{dots}</S.Container>;
  }

  return (
    <S.Container role="img" aria-label={`${count}개 중 ${index + 1}번째`}>
      {dots}
    </S.Container>
  );
};

export default PageIndicator;
