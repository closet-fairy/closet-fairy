import styled from '@emotion/styled';
import { fg, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
`;

export const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[24]};
  padding: ${spacing[24]} ${spacing[32]};
`;

export const Visual = styled.div`
  display: flex;
  justify-content: center;
  color: ${fg.neutral.strong};
`;

export const Heading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
  text-align: center;
`;

export const Title = styled.h1`
  ${typography.title1}
  color: ${fg.neutral.strong};
`;

export const Description = styled.p`
  ${typography.body3}
  color: ${fg.neutral.light};
`;

export const Content = styled.div`
  width: 100%;
`;

export const Actions = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${spacing[10]};
  padding: ${spacing[14]} ${spacing[20]} ${spacing[16]};
`;
