import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';

export const Container = styled.span`
  ${typography.caption2Strong}
  flex: none;
  padding: ${spacing[2]} ${spacing[6]};
  border-radius: ${radius.xs};
  background-color: ${bg.white};
  color: ${fg.neutral.soft};
  box-shadow: inset 0 0 0 1px ${border.neutral.default};
`;
