import styled from '@emotion/styled';
import { appFrame, bg, border, shadow } from '@/styles/tokens';

export const Outside = styled.div`
  min-height: 100dvh;
  background-color: ${bg.outside};
`;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  max-width: ${appFrame.maxWidth};
  min-height: 100dvh;
  margin: 0 auto;
  background-color: ${bg.white};
  /* border로 그리면 폭 480px 이하에서 콘텐츠가 2px 좁아진다. */
  box-shadow:
    0 0 0 1px ${border.neutral.default},
    ${shadow.app};
`;

export const Main = styled.main`
  display: flex;
  flex: 1;
  flex-direction: column;
`;
