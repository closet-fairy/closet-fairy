import { palette } from './palette';

const colorValues = {
  'fg-white': palette.white,
  'fg-neutral-strong': palette.gray900,
  'fg-neutral-default': palette.gray700,
  'fg-neutral-soft': palette.gray500,
  'fg-neutral-light': palette.gray400,
  'fg-neutral-pale': palette.gray300,
  'fg-error-default': palette.red500,

  'bg-white': palette.white,
  'bg-dim': palette.dim,
  'bg-neutral-strong': palette.gray900,
  'bg-neutral-default': palette.gray150,
  'bg-neutral-soft': palette.gray100,
  'bg-neutral-light': palette.gray50,
  'bg-neutral-pale': palette.gray25,
  'bg-error-light': palette.red100,
  'bg-floor': palette.warmGray200,

  'border-neutral-strong': palette.gray900,
  'border-neutral-default': palette.gray150,
  'border-neutral-soft': palette.gray100,
  'border-neutral-dashed': palette.gray250,
  'border-error-default': palette.red500,

  'swatch-black': palette.clothingBlack,
  'swatch-white': palette.clothingWhite,
  'swatch-gray': palette.clothingGray,
  'swatch-beige': palette.clothingBeige,
  'swatch-brown': palette.clothingBrown,
  'swatch-navy': palette.clothingNavy,
  'swatch-blue': palette.clothingBlue,
  'swatch-sky-blue': palette.clothingSkyBlue,
  'swatch-green': palette.clothingGreen,
  'swatch-khaki': palette.clothingKhaki,
  'swatch-yellow': palette.clothingYellow,
  'swatch-orange': palette.clothingOrange,
  'swatch-red': palette.clothingRed,
  'swatch-pink': palette.clothingPink,
} as const;

type ColorName = keyof typeof colorValues;

const colorVar = (name: ColorName) => `var(--color-${name})`;

export const colorVariables = Object.entries(colorValues)
  .map(([name, value]) => `--color-${name}: ${value};`)
  .join('\n');

export const fg = {
  white: colorVar('fg-white'),
  neutral: {
    strong: colorVar('fg-neutral-strong'),
    default: colorVar('fg-neutral-default'),
    soft: colorVar('fg-neutral-soft'),
    light: colorVar('fg-neutral-light'),
    pale: colorVar('fg-neutral-pale'),
  },
  error: {
    default: colorVar('fg-error-default'),
  },
} as const;

export const bg = {
  white: colorVar('bg-white'),
  dim: colorVar('bg-dim'),
  neutral: {
    strong: colorVar('bg-neutral-strong'),
    default: colorVar('bg-neutral-default'),
    soft: colorVar('bg-neutral-soft'),
    light: colorVar('bg-neutral-light'),
    pale: colorVar('bg-neutral-pale'),
  },
  error: {
    light: colorVar('bg-error-light'),
  },
  floor: colorVar('bg-floor'),
} as const;

export const border = {
  neutral: {
    strong: colorVar('border-neutral-strong'),
    default: colorVar('border-neutral-default'),
    soft: colorVar('border-neutral-soft'),
    dashed: colorVar('border-neutral-dashed'),
  },
  error: {
    default: colorVar('border-error-default'),
  },
} as const;

export const swatch = {
  black: colorVar('swatch-black'),
  white: colorVar('swatch-white'),
  gray: colorVar('swatch-gray'),
  beige: colorVar('swatch-beige'),
  brown: colorVar('swatch-brown'),
  navy: colorVar('swatch-navy'),
  blue: colorVar('swatch-blue'),
  skyBlue: colorVar('swatch-sky-blue'),
  green: colorVar('swatch-green'),
  khaki: colorVar('swatch-khaki'),
  yellow: colorVar('swatch-yellow'),
  orange: colorVar('swatch-orange'),
  red: colorVar('swatch-red'),
  pink: colorVar('swatch-pink'),
} as const;
