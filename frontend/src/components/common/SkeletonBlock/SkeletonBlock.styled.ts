import styled from '@emotion/styled';
import { bg, radius } from '@/styles/tokens';
import type { SkeletonBlockTone } from './SkeletonBlock';

const TONE_COLOR = {
  light: bg.neutral.light,
  soft: bg.neutral.soft,
} as const satisfies Record<SkeletonBlockTone, string>;

export const Container = styled.div<{ $tone: SkeletonBlockTone }>`
  border-radius: ${radius.sm};
  background-color: ${({ $tone }) => TONE_COLOR[$tone]};
`;
