import { Accordion } from '@base-ui/react/accordion';
import styled from '@emotion/styled';
import { transientOptions } from '@/styles/transientOptions';

export const Root = styled(Accordion.Root, transientOptions)`
  display: flex;
  flex-direction: column;
  width: 100%;
`;
