import styled from '@emotion/styled';
import {
  bg,
  duration,
  easing,
  fg,
  opacity,
  radius,
  spacing,
  typography,
} from '@/styles/tokens';
import { ROW_HEIGHT, VISIBLE_ROW_COUNT } from './WheelPicker.constants';

const EDGE_ROW_COUNT = Math.floor(VISIBLE_ROW_COUNT / 2);

const getRowOpacity = (distance: number) => {
  if (distance === 0) {
    return 1;
  }

  return distance === 1 ? opacity.muted : opacity.faint;
};

export const Container = styled.div`
  position: relative;
  display: flex;
  gap: ${spacing[8]};
  height: ${ROW_HEIGHT * VISIBLE_ROW_COUNT}px;
  padding: 0 ${spacing[8]};
`;

export const Band = styled.div`
  position: absolute;
  top: ${ROW_HEIGHT * EDGE_ROW_COUNT}px;
  right: 0;
  left: 0;
  height: ${ROW_HEIGHT}px;
  border-radius: ${radius.md};
  background-color: ${bg.neutral.light};
  pointer-events: none;
`;

export const List = styled.ul`
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  border-radius: ${radius.md};
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  touch-action: pan-y;

  &::-webkit-scrollbar {
    display: none;
  }

  &::before,
  &::after {
    content: '';
    display: block;
    height: ${ROW_HEIGHT * EDGE_ROW_COUNT}px;
  }
`;

export const Option = styled.li<{ $isSelected: boolean; $distance: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${ROW_HEIGHT}px;
  color: ${({ $isSelected }) =>
    $isSelected ? fg.neutral.strong : fg.neutral.default};
  opacity: ${({ $distance }) => getRowOpacity($distance)};
  cursor: pointer;
  user-select: none;
  scroll-snap-align: center;
  transition: opacity ${duration.fast} ${easing.standard};

  ${({ $isSelected }) => ($isSelected ? typography.title3 : typography.body1)}
`;
