import styled from '@emotion/styled';
import { createLink } from '@tanstack/react-router';
import { bg, fg, spacing, typography } from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  background-color: ${bg.white};
`;

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]};
  padding: ${spacing[2]} ${spacing[20]} 0;
`;

const CardAnchor = styled.a`
  display: block;
`;

export const CardLink = createLink(CardAnchor);

export const ListEnd = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[10]};
  padding: ${spacing[24]} ${spacing[20]} ${spacing[16]};
`;

export const ListEndMessage = styled.p`
  ${typography.label1}
  color: ${fg.neutral.light};
`;

export const LoadingMessage = styled.p`
  ${visuallyHidden}
`;
