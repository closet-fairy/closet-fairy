import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { fg, spacing, typography } from '@/styles/tokens';

interface StoryLabeledProps {
  label: string;
  children: ReactNode;
}

const StoryLabeled = (props: StoryLabeledProps) => {
  const { label, children } = props;

  return (
    <Container>
      {children}
      <Label>{label}</Label>
    </Container>
  );
};

export default StoryLabeled;

const Container = styled.figure`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[6]};
  min-width: 88px;
  color: ${fg.neutral.strong};
`;

const Label = styled.figcaption`
  ${typography.caption2}
  color: ${fg.neutral.light};
  text-align: center;
  word-break: break-all;
`;
