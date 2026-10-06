import type { StyledOptions } from '@emotion/styled';

export const transientOptions: StyledOptions = {
  shouldForwardProp: (propName) => !propName.startsWith('$'),
};
