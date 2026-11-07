import styled from '@emotion/styled';
import { fg, radius } from '@/styles/tokens';
import {
  CLOTHES_ICON_SIZE,
  DOT_SIZE,
  VISUAL_BOX_SIZE,
  WAND_ICON_SIZE,
  WAND_PIVOT,
} from './ClothesWandVisual.constants';

/*
 * 아래 요소의 transform과 opacity는 매 프레임 ref로 직접 쓴다.
 * 여기의 값은 첫 프레임을 그리기 전의 기본 모습이다.
 */
export const Container = styled.div`
  position: relative;
  flex: none;
  width: ${VISUAL_BOX_SIZE}px;
  height: ${VISUAL_BOX_SIZE}px;
  color: ${fg.neutral.strong};
`;

export const Clothes = styled.span`
  position: absolute;
  display: flex;
  width: ${CLOTHES_ICON_SIZE}px;
  height: ${CLOTHES_ICON_SIZE}px;
  opacity: 0;
`;

export const Wand = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  width: ${WAND_ICON_SIZE}px;
  height: ${WAND_ICON_SIZE}px;
  transform: scaleX(-1);
`;

export const WandSwing = styled.span`
  display: flex;
  width: ${WAND_ICON_SIZE}px;
  height: ${WAND_ICON_SIZE}px;
  transform-origin: ${WAND_PIVOT};
`;

export const Dot = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border-radius: ${radius.full};
  background-color: ${fg.neutral.strong};
  opacity: 0;
`;
