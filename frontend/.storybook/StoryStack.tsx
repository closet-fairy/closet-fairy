import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { spacing } from '@/styles/tokens';

interface StoryStackProps {
  children: ReactNode;
  direction?: 'row' | 'column';
  gap?: keyof typeof spacing;
  isWrapped?: boolean;
}

const StoryStack = (props: StoryStackProps) => {
  const { children, direction = 'row', gap = 12, isWrapped = false } = props;

  return (
    <Container $direction={direction} $gap={gap} $isWrapped={isWrapped}>
      {children}
    </Container>
  );
};

export default StoryStack;

const Container = styled.div<{
  $direction: 'row' | 'column';
  $gap: keyof typeof spacing;
  $isWrapped: boolean;
}>`
  display: flex;
  flex-direction: ${({ $direction }) => $direction};
  flex-wrap: ${({ $isWrapped }) => ($isWrapped ? 'wrap' : 'nowrap')};
  align-items: ${({ $direction }) => ($direction === 'row' ? 'center' : 'stretch')};
  gap: ${({ $gap }) => spacing[$gap]};
`;
