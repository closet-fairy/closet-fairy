import type { ClothingColor } from '@/constants/clothingAttribute';
import * as S from './ColorSwatch.styled';

interface ColorSwatchProps {
  color: ClothingColor;
}

const ColorSwatch = (props: ColorSwatchProps) => {
  const { color } = props;

  return <S.Dot $color={color} />;
};

export default ColorSwatch;
