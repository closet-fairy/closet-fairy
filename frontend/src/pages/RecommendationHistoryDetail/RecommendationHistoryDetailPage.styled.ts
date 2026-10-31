import styled from '@emotion/styled';
import { createLink } from '@tanstack/react-router';
import {
  bg,
  duration,
  easing,
  fg,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';

const FLOOR_LINK_HEIGHT = 36;
const PRESSED_SCALE = 0.94;

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

const FloorAnchor = styled.a`
  ${typography.label1Strong}
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  height: ${FLOOR_LINK_HEIGHT}px;
  margin: -${spacing[6]} -${spacing[6]} -${spacing[6]} 0;
  padding: 0 ${spacing[10]};
  border-radius: ${radius.sm};
  color: ${fg.neutral.strong};
  transition: transform ${duration.fast} ${easing.standard};

  &:active {
    transform: scale(${PRESSED_SCALE});
  }
`;

export const FloorLink = createLink(FloorAnchor);

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
