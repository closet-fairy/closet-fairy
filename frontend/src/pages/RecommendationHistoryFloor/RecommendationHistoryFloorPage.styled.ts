import styled from '@emotion/styled';
import { TOP_BAR_HEIGHT } from '@/components/common/TopBar/TopBar.styled';
import { bg, fg, spacing, typography, zIndex } from '@/styles/tokens';

const HEADER_BOTTOM = `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`;
const HEADER_FADE_START = '70%';

export const StatusPage = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  background-color: ${bg.white};
`;

export const Container = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  background-color: ${bg.floor};
`;

// 시안대로 바닥색이 아래쪽에서 투명하게 풀린다. 지금 배치는 옷이 영역 안에 머물러 겹치지 않지만, 배치가 바뀌어 옷이 바에 닿아도 경계가 보이지 않게 둔다.
export const Header = styled.header`
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: ${zIndex.sticky};
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  height: ${HEADER_BOTTOM};
  padding: env(safe-area-inset-top, 0px) ${spacing[20]} 0 ${spacing[8]};
  background: linear-gradient(${bg.floor} ${HEADER_FADE_START}, transparent);
`;

export const Heading = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

export const Title = styled.h1`
  ${typography.body1Strong}
  overflow: hidden;
  color: ${fg.neutral.strong};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const GoingOut = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  min-width: 0;
  color: ${fg.neutral.soft};
`;

export const GoingOutRange = styled.span`
  ${typography.caption1}
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

// 늘어난 높이로는 컨테이너 단위가 풀리지 않아, 상단 바 아래를 꽉 채우도록 위치로 크기를 정한다.
export const Floor = styled.div`
  position: absolute;
  inset: ${HEADER_BOTTOM} 0 0;
  container-type: size;
`;
