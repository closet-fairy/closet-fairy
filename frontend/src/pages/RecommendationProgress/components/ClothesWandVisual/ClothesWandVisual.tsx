import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import Icon from '@/components/common/Icon';
import usePageVisibility from '../../hooks/usePageVisibility';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import {
  CLOTHES_NAMES,
  DOT_ANGLE_OFFSETS,
  MAX_FRAME_GAP_MS,
} from './ClothesWandVisual.constants';
import { CLOTHES_WAND_LAYOUTS } from './ClothesWandVisual.layout';
import * as S from './ClothesWandVisual.styled';
import getClothesWandFrame from './getClothesWandFrame';

const ClothesWandVisual = () => {
  const isReducedMotion = usePrefersReducedMotion();
  const isPageVisible = usePageVisibility();
  const elapsedMsRef = useRef(0);
  const clothesRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wandRef = useRef<HTMLSpanElement | null>(null);
  const wandSwingRef = useRef<HTMLSpanElement | null>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const draw = useEffectEvent((elapsedMs: number) => {
    const frame = getClothesWandFrame(elapsedMs, isReducedMotion);

    frame.clothes.forEach(({ opacity, scale }, index) => {
      const element = clothesRefs.current[index];

      if (element) {
        element.style.opacity = String(opacity);
        element.style.transform = `scale(${scale})`;
      }
    });

    if (wandRef.current) {
      wandRef.current.style.transform = `translate(${frame.wand.left}px, ${frame.wand.top}px) scaleX(-1)`;
    }

    if (wandSwingRef.current) {
      wandSwingRef.current.style.transform = `rotate(${frame.wand.angle}deg)`;
    }

    dotRefs.current.forEach((element, index) => {
      if (!element) {
        return;
      }

      const dot = frame.dots?.[index];

      element.style.opacity = dot ? String(dot.opacity) : '0';

      if (dot) {
        element.style.transform = `translate(${dot.x}px, ${dot.y}px) scale(${dot.scale})`;
      }
    });
  });

  // 첫 화면이 그려지기 전에 지금 시각의 모습을 먼저 입힌다.
  useLayoutEffect(() => {
    draw(elapsedMsRef.current);
  }, [isReducedMotion]);

  useEffect(() => {
    if (!isPageVisible) {
      return;
    }

    let animationFrameId = 0;
    let lastTimestamp: number | null = null;

    const tick = (timestamp: number) => {
      if (lastTimestamp !== null) {
        elapsedMsRef.current += Math.min(
          timestamp - lastTimestamp,
          MAX_FRAME_GAP_MS,
        );
      }

      lastTimestamp = timestamp;
      draw(elapsedMsRef.current);
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPageVisible]);

  return (
    <S.Container aria-hidden>
      {CLOTHES_NAMES.map((name, index) => (
        <S.Clothes
          key={name}
          ref={(element) => {
            clothesRefs.current[index] = element;
          }}
          style={{
            left: CLOTHES_WAND_LAYOUTS[name].clothes.left,
            top: CLOTHES_WAND_LAYOUTS[name].clothes.top,
          }}
        >
          <Icon name={name} size="3xl" />
        </S.Clothes>
      ))}
      <S.Wand ref={wandRef}>
        <S.WandSwing ref={wandSwingRef}>
          <Icon name="wand_stars" size="xl" />
        </S.WandSwing>
      </S.Wand>
      {DOT_ANGLE_OFFSETS.map((offset, index) => (
        <S.Dot
          key={offset}
          ref={(element) => {
            dotRefs.current[index] = element;
          }}
        />
      ))}
    </S.Container>
  );
};

export default ClothesWandVisual;
