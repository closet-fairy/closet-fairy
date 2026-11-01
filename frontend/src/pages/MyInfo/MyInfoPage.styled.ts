import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[24]};
  padding: ${spacing[8]} ${spacing[20]} ${spacing[32]};
`;

export const Profile = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[6]};
`;

export const Nickname = styled.p`
  ${typography.title2}
  overflow-wrap: anywhere;
  color: ${fg.neutral.strong};
`;

export const Account = styled.p`
  ${typography.caption1}
  color: ${fg.neutral.light};
`;

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${spacing[10]};
`;

export const SectionTitle = styled.h2`
  ${typography.label1Strong}
  color: ${fg.neutral.light};
`;

export const LoadingMessage = styled.p`
  ${visuallyHidden}
`;
