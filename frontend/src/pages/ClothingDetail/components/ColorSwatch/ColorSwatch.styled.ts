import styled from '@emotion/styled';
import type { ClothingColor } from '@/constants/clothingAttribute';
import { border, radius, swatch } from '@/styles/tokens';

const DOT_SIZE = 16;

const SWATCH_COLOR: Record<ClothingColor, string> = {
  black: swatch.black,
  white: swatch.white,
  gray: swatch.gray,
  beige: swatch.beige,
  brown: swatch.brown,
  navy: swatch.navy,
  blue: swatch.blue,
  sky_blue: swatch.skyBlue,
  green: swatch.green,
  khaki: swatch.khaki,
  yellow: swatch.yellow,
  orange: swatch.orange,
  red: swatch.red,
  burgundy: swatch.burgundy,
  pink: swatch.pink,
  purple: swatch.purple,
};

// 흰색처럼 바탕과 비슷한 색도 보이도록 옅은 안쪽 테두리를 둘러 둔다.
export const Dot = styled.span<{ $color: ClothingColor }>`
  display: inline-block;
  flex: none;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border-radius: ${radius.full};
  background-color: ${({ $color }) => SWATCH_COLOR[$color]};
  box-shadow: inset 0 0 0 1px ${border.neutral.default};
`;
