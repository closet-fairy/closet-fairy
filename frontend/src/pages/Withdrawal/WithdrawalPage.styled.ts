import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: ${bg.white};
`;

export const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[16]};
  min-height: 0;
  overflow-y: auto;
  padding: ${spacing[4]} ${spacing[20]} ${spacing[24]};
`;

export const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]};
`;

export const Heading = styled.h2`
  ${typography.title2}
  color: ${fg.neutral.strong};
`;

export const Message = styled.p`
  ${typography.body3}
  color: ${fg.neutral.default};

  & strong {
    ${typography.body3Strong}
    color: ${fg.neutral.strong};
  }
`;

export const RecordList = styled.ul`
  border: 1px solid ${border.neutral.strong};
  border-radius: ${radius.md};
`;

export const Record = styled.li`
  ${typography.body3}
  display: flex;
  align-items: center;
  gap: ${spacing[10]};
  padding: ${spacing[12]} ${spacing[14]};
  color: ${fg.neutral.strong};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${border.neutral.default};
  }
`;

export const Confirm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]};
`;

export const ConfirmLabel = styled.label`
  ${typography.label1}
  color: ${fg.neutral.default};

  & strong {
    ${typography.label1Strong}
    color: ${fg.neutral.strong};
  }
`;

export const Guide = styled.p`
  ${typography.caption1}
  color: ${fg.neutral.light};
`;

export const Footer = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${spacing[8]};
  padding: ${spacing[12]} ${spacing[20]}
    calc(${spacing[16]} + env(safe-area-inset-bottom, 0px));
  background-color: ${bg.white};
`;

export const ErrorMessage = styled.p`
  ${typography.label1}
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  color: ${fg.error.default};
`;
