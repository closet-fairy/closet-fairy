import { ToggleGroup } from '@base-ui/react/toggle-group';
import styled from '@emotion/styled';
import { spacing } from '@/styles/tokens';
import { transientOptions } from '@/styles/transientOptions';

export const Container = styled(ToggleGroup, transientOptions)`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]};
`;
