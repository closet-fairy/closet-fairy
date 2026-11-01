import styled from '@emotion/styled';
import Skeleton from '@/components/common/Skeleton';
import SkeletonBlock from '@/components/common/SkeletonBlock';
import { radius, spacing, typography } from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';
import { cardBox } from '../SettingSummary/SettingSummary.styled';

export const Container = styled(Skeleton)`
  ${cardBox}
`;

export const Tag = styled(SkeletonBlock, transientOptions)<{ $width: string }>`
  ${typography.caption1Strong}
  display: flex;
  width: ${({ $width }) => $width};
  padding: ${spacing[4]} 0;
  border-radius: ${radius.full};

  &::before {
    content: '\\200b';
  }
`;
