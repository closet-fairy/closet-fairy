import styled from '@emotion/styled';
import {
  bg,
  border,
  duration,
  easing,
  fg,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';

const FOOTER_HEIGHT = 88;
const PROGRESS_WIDTH = 128;
const PROGRESS_HEIGHT = 4;
const CONTINUE_MIN_WIDTH = 96;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: ${bg.white};
`;

export const Header = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  padding: ${spacing[24]} ${spacing[24]} 0;
`;

export const Badge = styled.div`
  display: flex;
  margin-bottom: ${spacing[12]};
`;

export const Title = styled.h1`
  ${typography.title1}
  color: ${fg.neutral.strong};

  &:focus {
    outline: none;
  }
`;

export const Description = styled.p`
  ${typography.body3}
  margin-top: ${spacing[8]};
  color: ${fg.neutral.soft};
`;

export const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${spacing[32]} ${spacing[24]} ${spacing[24]};
`;

export const ErrorMessage = styled.p`
  ${typography.label1}
  display: flex;
  flex: none;
  align-items: center;
  gap: ${spacing[4]};
  padding: 0 ${spacing[24]} ${spacing[12]};
  color: ${fg.error.default};
`;

export const Footer = styled.div<{ $hasDivider: boolean }>`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[16]};
  min-height: ${FOOTER_HEIGHT}px;
  padding: 0 ${spacing[24]} env(safe-area-inset-bottom, 0px);
  border-top: 1px solid
    ${({ $hasDivider }) => ($hasDivider ? border.neutral.soft : 'transparent')};
  background-color: ${bg.white};
`;

export const Progress = styled.div`
  position: relative;
  flex: none;
  width: ${PROGRESS_WIDTH}px;
  height: ${PROGRESS_HEIGHT}px;
  overflow: hidden;
  border-radius: ${radius.full};
  background-color: ${bg.neutral.soft};
`;

export const ProgressFill = styled.div`
  height: 100%;
  border-radius: ${radius.full};
  background-color: ${bg.neutral.strong};
  transition: width ${duration.slow} ${easing.standard};
`;

export const ContinueButton = styled.div`
  flex: none;
  min-width: ${CONTINUE_MIN_WIDTH}px;
`;
