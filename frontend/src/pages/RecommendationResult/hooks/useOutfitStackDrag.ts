import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { duration } from '@/styles/tokens';
import isReducedMotion from '@/utils/isReducedMotion';

export type StackDirection = 'older' | 'newer';

interface StackMotion {
  direction: StackDirection;
  offset: number;
  isSettling: boolean;
  isCommitted: boolean;
}

interface StackGesture {
  pointerId: number;
  startX: number;
  startY: number;
  axis: 'x' | 'y' | null;
  distance: number;
  commitDistance: number;
  exitOffset: number;
}

interface UseOutfitStackDragOptions {
  isEnabled: boolean;
  hasOlder: boolean;
  hasNewer: boolean;
  onSettle: (direction: StackDirection) => void;
}

const COMMIT_RATIO = 0.15;
const AXIS_LOCK_DISTANCE = 8;
const SETTLE_MS = Number.parseInt(duration.slow, 10);

/*
 * 앞 카드의 세로 위치를 다룬다. 이전 코디로 갈 때는 앞 카드가 제자리에서 화면 밖으로 내려가고,
 * 최신 쪽으로 갈 때는 화면 밖에 있던 앞 카드가 제자리로 올라온다.
 */
const useOutfitStackDrag = (options: UseOutfitStackDragOptions) => {
  const { isEnabled, hasOlder, hasNewer, onSettle } = options;
  const [motion, setMotion] = useState<StackMotion | null>(null);
  const gestureRef = useRef<StackGesture | null>(null);

  const getDirection = (distance: number): StackDirection | null => {
    if (distance > 0 && hasOlder) return 'older';
    if (distance < 0 && hasNewer) return 'newer';

    return null;
  };

  const finish = (settled: StackMotion) => {
    setMotion(null);

    if (settled.isCommitted) {
      onSettle(settled.direction);
    }
  };

  const finishSettling = useEffectEvent(finish);

  useEffect(() => {
    if (!motion?.isSettling) return;

    const timer = setTimeout(() => {
      finishSettling(motion);
    }, SETTLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [motion]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!isEnabled || motion !== null || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const { height, top } = event.currentTarget.getBoundingClientRect();

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      distance: 0,
      commitDistance: height * COMMIT_RATIO,
      exitOffset: window.innerHeight - top,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture?.pointerId !== event.pointerId) return;

    // 축을 정하기 전에 카드 밖에서 버튼을 떼면 pointerup을 받지 못한다.
    if (
      gesture.axis === null &&
      event.pointerType === 'mouse' &&
      event.buttons === 0
    ) {
      gestureRef.current = null;
      return;
    }

    const moveX = Math.abs(event.clientX - gesture.startX);
    const distance = event.clientY - gesture.startY;

    // 좌우 스와이프는 캐러셀이 맡으므로, 처음 움직인 방향이 세로일 때만 잡는다.
    if (gesture.axis === null) {
      if (Math.max(moveX, Math.abs(distance)) < AXIS_LOCK_DISTANCE) return;

      gesture.axis = Math.abs(distance) >= moveX ? 'y' : 'x';

      if (gesture.axis === 'y') {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    if (gesture.axis === 'x') return;

    const direction = getDirection(distance);

    gesture.distance = distance;
    setMotion(
      direction && {
        direction,
        offset:
          direction === 'older' ? distance : gesture.exitOffset + distance,
        isSettling: false,
        isCommitted: false,
      },
    );
  };

  // 빠르게 튕기면 마지막 이동이 그려지기 전에 놓을 수 있어서, 그려진 motion이 아니라 손의 위치로 판단한다.
  const settle = (gesture: StackGesture, isCommitted: boolean) => {
    const direction =
      gesture.axis === 'y' ? getDirection(gesture.distance) : null;

    if (direction === null) {
      setMotion(null);
      return;
    }

    const isLeavingScreen = (direction === 'older') === isCommitted;
    const settled = {
      direction,
      offset: isLeavingScreen ? gesture.exitOffset : 0,
      isSettling: true,
      isCommitted,
    };

    if (isReducedMotion()) {
      finish(settled);
      return;
    }

    setMotion(settled);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture?.pointerId !== event.pointerId) return;

    gestureRef.current = null;
    settle(gesture, Math.abs(gesture.distance) >= gesture.commitDistance);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture?.pointerId !== event.pointerId) return;

    gestureRef.current = null;
    settle(gesture, false);
  };

  return {
    motion,
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
};

export default useOutfitStackDrag;
