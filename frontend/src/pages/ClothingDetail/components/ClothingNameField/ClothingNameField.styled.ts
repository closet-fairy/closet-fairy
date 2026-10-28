import styled from '@emotion/styled';
import { border, fg, spacing, typography } from '@/styles/tokens';

// 아코디언 행의 라벨 칸과 폭을 맞춘다.
const LABEL_WIDTH = 76;

export const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[8]};
  padding: ${spacing[12]} 0;
  border-bottom: 1px solid ${border.neutral.soft};
`;

export const Label = styled.label`
  ${typography.body2}
  flex: none;
  width: ${LABEL_WIDTH}px;
  padding-top: ${spacing[12]};
  color: ${fg.neutral.light};
`;

export const Field = styled.div`
  flex: 1;
  min-width: 0;
`;
