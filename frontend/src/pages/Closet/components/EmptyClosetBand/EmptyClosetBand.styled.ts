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
import {
  GRID_COLUMN_COUNT,
  GRID_COLUMN_GAP,
  REGISTER_PRESSED_SCALE,
} from '../../constants';

export const Container = styled.div`
  grid-column: 1 / -1;
  container-type: inline-size;
`;

export const Band = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[10]};
  width: 100%;
  height: calc(
    (100cqw - ${GRID_COLUMN_COUNT - 1} * ${GRID_COLUMN_GAP}) /
      ${GRID_COLUMN_COUNT} * 4 / 3
  );
  border: 1px dashed ${border.neutral.dashed};
  border-radius: ${radius.sm};
  background-color: ${bg.neutral.pale};
  text-align: center;
  transition: transform ${duration.fast} ${easing.standard};

  &:active {
    transform: scale(${REGISTER_PRESSED_SCALE});
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const IconWrapper = styled.span`
  display: inline-flex;
  color: ${fg.neutral.pale};
`;

export const Texts = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing[2]};
`;

export const Title = styled.span`
  ${typography.body3Strong}
  color: ${fg.neutral.strong};
`;

export const Description = styled.span`
  ${typography.caption1}
  color: ${fg.neutral.soft};
`;
