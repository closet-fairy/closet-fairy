import styled from '@emotion/styled';
import { fg, radius, spacing, typography } from '@/styles/tokens';

const ROW_HEIGHT = 44;
// 붓 크기가 4~80px로 바뀌어도 슬라이더 길이가 흔들리지 않게 값 자리를 고정한다.
const VALUE_WIDTH = 38;
const LABEL_WIDTH = 28;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[14]};
`;

export const ToolRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[6]};
`;

export const ModeControl = styled.div`
  flex: 1;
  min-width: 0;
`;

export const SizeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[12]};
  height: ${ROW_HEIGHT}px;
`;

export const SizeLabel = styled.span`
  ${typography.label1Strong}
  flex: none;
  width: ${LABEL_WIDTH}px;
  color: ${fg.neutral.light};
`;

export const SmallDot = styled.span`
  flex: none;
  width: ${spacing[6]};
  height: ${spacing[6]};
  border-radius: ${radius.full};
  background-color: ${fg.neutral.pale};
`;

export const LargeDot = styled.span`
  flex: none;
  width: ${spacing[16]};
  height: ${spacing[16]};
  border-radius: ${radius.full};
  background-color: ${fg.neutral.pale};
`;

export const SliderSlot = styled.div`
  flex: 1;
  min-width: 0;
`;

export const SizeValue = styled.span`
  ${typography.label1Strong}
  flex: none;
  width: ${VALUE_WIDTH}px;
  color: ${fg.neutral.strong};
  font-variant-numeric: tabular-nums;
  text-align: right;
`;
