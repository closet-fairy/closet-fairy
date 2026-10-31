import type { ClothingDetail } from '@/generated/models';

export type ClothingCategory = NonNullable<ClothingDetail['category_cd']>;
export type AccessoryType = NonNullable<ClothingDetail['accessory_type_cd']>;
export type ClothingColor = NonNullable<ClothingDetail['color_cd']>;
export type ClothingStyle = ClothingDetail['style_cds'][number];
export type ClothingSeason = ClothingDetail['season_cds'][number];
export type ClothingThickness = NonNullable<ClothingDetail['thickness_cd']>;

export const CLOTHING_CATEGORIES = [
  'outer',
  'top',
  'bottom',
  'shoes',
  'socks',
  'accessories',
] as const satisfies readonly ClothingCategory[];

export const CLOTHING_CATEGORY_LABEL: Record<ClothingCategory, string> = {
  outer: '아우터',
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  socks: '양말',
  accessories: '악세서리',
};

export const ACCESSORY_TYPES = [
  'hat',
  'bag',
  'belt',
  'watch',
  'scarf',
  'eyewear',
  'jewelry',
  'etc',
] as const satisfies readonly AccessoryType[];

export const ACCESSORY_TYPE_LABEL: Record<AccessoryType, string> = {
  hat: '모자',
  bag: '가방',
  belt: '벨트',
  watch: '시계',
  scarf: '스카프',
  eyewear: '안경',
  jewelry: '주얼리',
  etc: '기타',
};

export const CLOTHING_COLORS = [
  'black',
  'white',
  'gray',
  'beige',
  'brown',
  'navy',
  'blue',
  'sky_blue',
  'green',
  'khaki',
  'yellow',
  'orange',
  'red',
  'burgundy',
  'pink',
  'purple',
] as const satisfies readonly ClothingColor[];

export const CLOTHING_COLOR_LABEL: Record<ClothingColor, string> = {
  black: '검정',
  white: '흰색',
  gray: '회색',
  beige: '베이지',
  brown: '갈색',
  navy: '네이비',
  blue: '파랑',
  sky_blue: '하늘',
  green: '초록',
  khaki: '카키',
  yellow: '노랑',
  orange: '주황',
  red: '빨강',
  burgundy: '버건디',
  pink: '분홍',
  purple: '보라',
};

export const CLOTHING_SEASONS = [
  'spring',
  'summer',
  'fall',
  'winter',
] as const satisfies readonly ClothingSeason[];

export const CLOTHING_SEASON_LABEL: Record<ClothingSeason, string> = {
  spring: '봄',
  summer: '여름',
  fall: '가을',
  winter: '겨울',
};

export const CLOTHING_THICKNESSES = [
  'thin',
  'medium',
  'thick',
] as const satisfies readonly ClothingThickness[];

export const CLOTHING_THICKNESS_LABEL: Record<ClothingThickness, string> = {
  thin: '얇음',
  medium: '보통',
  thick: '두꺼움',
};
