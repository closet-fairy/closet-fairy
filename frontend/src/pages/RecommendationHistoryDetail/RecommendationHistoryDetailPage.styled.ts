import styled from '@emotion/styled';
import { bg, fg, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  background-color: ${bg.white};
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[24]};
  padding: ${spacing[20]} ${spacing[20]} ${spacing[32]};
`;

export const Summary = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${spacing[12]};
`;

export const Title = styled.h2`
  ${typography.title1}
  width: 100%;
  color: ${fg.neutral.strong};
  overflow-wrap: anywhere;
`;

export const Times = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]};
  width: 100%;
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing[10]};
`;

export const SectionTitle = styled.h3`
  ${typography.label1Strong}
  color: ${fg.neutral.light};
`;

export const ReasonHeading = styled.h3`
  ${typography.label1Strong}
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
  margin-bottom: ${spacing[6]};
  color: ${fg.neutral.strong};
`;

export const ReasonText = styled.p`
  ${typography.body3}
  color: ${fg.neutral.default};
`;
