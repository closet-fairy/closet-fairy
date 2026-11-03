import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { PointerEvent } from 'react';
import isReducedMotion from '@/utils/isReducedMotion';
import { OUTFIT_PAGER } from './useOutfitPager.constants';

type PagerPhase = 'idle' | 'drag' | 'settle';

interface PointerSample {
  time: number;
  y: number;
}

interface PagerGesture {
  pointerId: number;
  startX: number;
  startY: number;
  axis: 'x' | 'y' | null;
  startPos: number;
  startPresence: number;
  origin: number;
  samples: PointerSample[];
  isCatching: boolean;
  isAbandoned: boolean;
}

interface PagerSettle {
  startTime: number;
  lastTime: number;
  presenceFrom: number;
  distanceFrom: number;
}

interface UseOutfitPagerOptions {
  layerCount: number;
  depth: number;
  isEnabled: boolean;
  onDepthChange: (depth: number) => void;
  onPresenceChange?: (presence: number) => void;
}

const SPRING_STEP_MS = 4;
const MAX_FRAME_MS = 64;
const REST_DISTANCE_PX = 0.5;
const REST_SPEED_PX_PER_MS = 0.02;
const MIN_LANDING_DISTANCE = 0.02;
const CAROUSEL_REST_TOLERANCE_PX = 2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getVelocity = (
  samples: readonly PointerSample[],
  releaseTime: number,
) => {
  const last = samples.at(-1);

  if (
    last === undefined ||
    releaseTime - last.time > OUTFIT_PAGER.STALE_RELEASE_MS
  ) {
    return 0;
  }

  const first =
    samples.find(
      ({ time }) => last.time - time <= OUTFIT_PAGER.VELOCITY_WINDOW_MS,
    ) ?? last;
  const elapsed = last.time - first.time;

  return elapsed > 0 ? (last.y - first.y) / elapsed : 0;
};

const isCarouselMoving = (stack: HTMLElement) => {
  const carousel = stack.closest('[data-carousel]');

  if (carousel === null) return false;

  const stackRect = stack.getBoundingClientRect();
  const carouselRect = carousel.getBoundingClientRect();
  const leftGap = stackRect.left - carouselRect.left;
  const rightGap = carouselRect.right - stackRect.right;

  return Math.abs(leftGap - rightGap) > CAROUSEL_REST_TOLERANCE_PX;
};

const getScale = (presence: number) =>
  1 - (1 - OUTFIT_PAGER.CARD_SCALE) * presence;

const useOutfitPager = (options: UseOutfitPagerOptions) => {
  const { layerCount, depth, isEnabled, onDepthChange, onPresenceChange } =
    options;
  const stackRef = useRef<HTMLDivElement>(null);
  const layerElementsRef = useRef(new Map<number, HTMLElement>());
  const layerRefCallbacksRef = useRef(
    new Map<number, (element: HTMLElement | null) => void>(),
  );
  const posRef = useRef(depth);
  const presenceRef = useRef(0);
  const velocityRef = useRef(0);
  const phaseRef = useRef<PagerPhase>('idle');
  const targetRef = useRef(depth);
  const committedRef = useRef(depth);
  const heightRef = useRef(0);
  const gestureRef = useRef<PagerGesture | null>(null);
  const settleRef = useRef<PagerSettle | null>(null);
  const frameRef = useRef<number | null>(null);
  const layerCountRef = useRef(layerCount);
  const onPresenceChangeRef = useRef(onPresenceChange);
  const reportedPresenceRef = useRef(0);
  const [nearest, setNearest] = useState(depth);
  const [movingRange, setMovingRange] = useState<readonly [number, number]>([
    depth - 1,
    depth + 1,
  ]);
  const [isMoving, setIsMoving] = useState(false);

  useLayoutEffect(() => {
    layerCountRef.current = layerCount;
    onPresenceChangeRef.current = onPresenceChange;
  });

  const measureCardHeight = () => {
    const [layer] = layerElementsRef.current.values();

    return layer?.offsetHeight ?? stackRef.current?.offsetHeight ?? 0;
  };

  const getSpacing = (presence: number) =>
    heightRef.current * getScale(presence) + OUTFIT_PAGER.CARD_GAP_PX;

  const apply = () => {
    if (heightRef.current === 0) {
      heightRef.current = measureCardHeight();
    }

    const pos = posRef.current;
    const presence = presenceRef.current;
    const scale = getScale(presence);
    const spacing = getSpacing(presence);
    const isMovingNow = phaseRef.current !== 'idle';

    stackRef.current?.style.setProperty('--card-presence', String(presence));
    stackRef.current?.toggleAttribute('data-revealed', presence > 0);

    layerElementsRef.current.forEach((element, layerDepth) => {
      const distance = Math.abs(pos - layerDepth);
      const ownership = Math.max(0, 1 - distance);
      const contentOpacity = ownership + (1 - ownership) * presence;
      const surfaceOpacity = presence;

      element.style.transform = `translate3d(0, ${(pos - layerDepth) * spacing}px, 0) scale(${scale})`;
      element.style.zIndex = String(100 - Math.round(distance * 10));
      element.style.visibility =
        contentOpacity < 0.001 && surfaceOpacity < 0.001 ? 'hidden' : '';
      element.style.willChange = isMovingNow ? 'transform' : '';
      element.style.setProperty('--content-opacity', String(contentOpacity));
      element.style.setProperty('--surface-opacity', String(surfaceOpacity));
      element.style.setProperty(
        '--surface-distance',
        String(Math.min(1, distance)),
      );
    });

    if (reportedPresenceRef.current !== presence) {
      reportedPresenceRef.current = presence;
      onPresenceChangeRef.current?.(presence);
    }

    setNearest(clamp(Math.round(pos), 0, layerCountRef.current - 1));

    if (isMovingNow) {
      const low = Math.min(Math.floor(pos), targetRef.current) - 1;
      const high = Math.max(Math.ceil(pos), targetRef.current) + 1;

      setMovingRange((range) =>
        range[0] === low && range[1] === high ? range : [low, high],
      );
    }
  };

  const stopFrame = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  const snapTo = (target: number) => {
    stopFrame();
    settleRef.current = null;
    phaseRef.current = 'idle';
    posRef.current = target;
    presenceRef.current = 0;
    velocityRef.current = 0;
    targetRef.current = target;
    apply();
    setIsMoving(false);
  };

  const getPresenceShare = (settle: PagerSettle, now: number) => {
    const fadeProgress = clamp(
      (now - settle.startTime - OUTFIT_PAGER.FADE_DELAY_MS) /
        OUTFIT_PAGER.FADE_DURATION_MS,
      0,
      1,
    );
    const timeShare = (1 - fadeProgress) ** 3;
    const landingWindow = Math.min(
      OUTFIT_PAGER.LANDING_WINDOW,
      settle.distanceFrom,
    );
    const landingProgress =
      landingWindow < MIN_LANDING_DISTANCE
        ? 0
        : Math.min(
            1,
            Math.abs(posRef.current - targetRef.current) / landingWindow,
          );
    const landingShare =
      landingProgress * landingProgress * (3 - 2 * landingProgress);

    return Math.max(timeShare, landingShare);
  };

  const tick = (now: number) => {
    const settle = settleRef.current;

    if (settle === null) return;

    const target = targetRef.current;
    const omega = (2 * Math.PI) / OUTFIT_PAGER.SPRING_RESPONSE_MS;
    const stiffness = omega * omega;
    const damping = 2 * OUTFIT_PAGER.SPRING_DAMPING * omega;
    let remaining = Math.min(MAX_FRAME_MS, now - settle.lastTime);

    settle.lastTime = now;

    while (remaining > 0) {
      const step = Math.min(SPRING_STEP_MS, remaining);
      const acceleration =
        -stiffness * (posRef.current - target) - damping * velocityRef.current;

      velocityRef.current += acceleration * step;
      posRef.current += velocityRef.current * step;
      remaining -= step;
    }

    const spacing = getSpacing(presenceRef.current);
    const isSpringResting =
      Math.abs(posRef.current - target) * spacing < REST_DISTANCE_PX &&
      Math.abs(velocityRef.current) * spacing < REST_SPEED_PX_PER_MS;

    if (isSpringResting) {
      posRef.current = target;
      velocityRef.current = 0;
    }

    presenceRef.current = settle.presenceFrom * getPresenceShare(settle, now);

    if (isSpringResting && presenceRef.current < 0.001) {
      snapTo(target);
      return;
    }

    apply();
    frameRef.current = requestAnimationFrame(tick);
  };

  const startSettle = () => {
    stopFrame();
    phaseRef.current = 'settle';
    const now = performance.now();

    settleRef.current = {
      startTime: now,
      lastTime: now,
      presenceFrom: presenceRef.current,
      distanceFrom: Math.abs(posRef.current - targetRef.current),
    };
    setIsMoving(true);
    frameRef.current = requestAnimationFrame(tick);
  };

  const commit = (target: number) => {
    targetRef.current = target;

    if (target !== committedRef.current) {
      committedRef.current = target;
      onDepthChange(target);
    }

    if (isReducedMotion()) {
      snapTo(target);
      return;
    }

    startSettle();
  };

  useLayoutEffect(() => {
    if (depth === committedRef.current) return;

    committedRef.current = depth;

    if (gestureRef.current !== null) {
      gestureRef.current.isAbandoned = true;
    }

    snapTo(depth);
  });

  useLayoutEffect(() => {
    apply();
  });

  useEffect(
    () => () => {
      stopFrame();

      if (reportedPresenceRef.current > 0) {
        onPresenceChangeRef.current?.(0);
      }
    },
    [],
  );

  useEffect(() => {
    const stack = stackRef.current;

    if (stack === null) return;

    const blockCarousel = (event: Event) => {
      const gesture = gestureRef.current;

      if (gesture !== null && gesture.axis !== 'x') {
        event.stopPropagation();
      }
    };

    stack.addEventListener('touchmove', blockCarousel);
    stack.addEventListener('mousemove', blockCarousel);

    return () => {
      stack.removeEventListener('touchmove', blockCarousel);
      stack.removeEventListener('mousemove', blockCarousel);
    };
  }, []);

  const getRubberPos = (rawPos: number, spacing: number) => {
    const max = layerCountRef.current - 1;

    if (rawPos >= 0 && rawPos <= max) return rawPos;

    const bound = rawPos < 0 ? 0 : max;
    const excess = Math.abs(rawPos - bound) * spacing;
    const limit = spacing * OUTFIT_PAGER.EDGE_RESISTANCE;
    const damped =
      limit *
      (1 - 1 / ((excess * OUTFIT_PAGER.RUBBER_COEFFICIENT) / limit + 1));

    return bound + (Math.sign(rawPos - bound) * damped) / spacing;
  };

  const followPointer = (gesture: PagerGesture, clientY: number) => {
    const distance = clientY - gesture.startY;
    const presence = Math.max(
      gesture.startPresence,
      Math.min(1, Math.abs(distance) / OUTFIT_PAGER.REVEAL_DISTANCE_PX),
    );
    const spacing = getSpacing(presence);

    presenceRef.current = presence;
    posRef.current = getRubberPos(
      gesture.startPos + distance / spacing,
      spacing,
    );
    apply();
  };

  const catchSettle = () => {
    stopFrame();
    settleRef.current = null;
    phaseRef.current = 'drag';
    velocityRef.current = 0;
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!isEnabled || layerCount < 2 || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const isSettling = phaseRef.current === 'settle';

    if (!isSettling && isCarouselMoving(event.currentTarget)) return;

    heightRef.current =
      measureCardHeight() || event.currentTarget.getBoundingClientRect().height;

    const isCatching =
      isSettling &&
      Math.abs(posRef.current - targetRef.current) *
        getSpacing(presenceRef.current) >
        OUTFIT_PAGER.CATCH_DISTANCE_PX;

    if (isCatching) {
      catchSettle();
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: isCatching ? 'y' : null,
      startPos: posRef.current,
      startPresence: presenceRef.current,
      origin: isCatching ? targetRef.current : Math.round(posRef.current),
      samples: [{ time: event.timeStamp, y: event.clientY }],
      isCatching,
      isAbandoned: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture?.pointerId !== event.pointerId || gesture.isAbandoned) return;

    if (
      gesture.axis === null &&
      event.pointerType === 'mouse' &&
      event.buttons === 0
    ) {
      gestureRef.current = null;
      return;
    }

    if (gesture.axis === null) {
      const moveX = Math.abs(event.clientX - gesture.startX);
      const moveY = Math.abs(event.clientY - gesture.startY);

      if (Math.max(moveX, moveY) < OUTFIT_PAGER.AXIS_LOCK_DISTANCE_PX) return;

      gesture.axis = moveY >= moveX * OUTFIT_PAGER.VERTICAL_BIAS ? 'y' : 'x';

      if (gesture.axis === 'x') {
        gestureRef.current = null;
        return;
      }

      if (phaseRef.current === 'settle') {
        catchSettle();
        gesture.startY = event.clientY;
        gesture.startPos = posRef.current;
        gesture.startPresence = presenceRef.current;
        gesture.origin = targetRef.current;
        gesture.isCatching = true;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      phaseRef.current = 'drag';
      setIsMoving(true);
    }

    gesture.samples.push({ time: event.timeStamp, y: event.clientY });

    while (
      gesture.samples.length > 2 &&
      event.timeStamp - gesture.samples[0].time >
        OUTFIT_PAGER.VELOCITY_WINDOW_MS * 2
    ) {
      gesture.samples.shift();
    }

    followPointer(gesture, event.clientY);
  };

  const getReleaseTarget = (gesture: PagerGesture, velocity: number) => {
    const pos = posRef.current;
    const distance =
      Math.abs(pos - gesture.startPos) * getSpacing(presenceRef.current);
    const isFlick =
      Math.abs(velocity) >= OUTFIT_PAGER.FLICK_VELOCITY_PX_PER_MS &&
      distance >= OUTFIT_PAGER.FLICK_MIN_DISTANCE_PX;

    if (isFlick) {
      return velocity > 0 ? Math.floor(pos) + 1 : Math.ceil(pos) - 1;
    }

    if (gesture.isCatching) {
      const moved = pos - gesture.startPos;

      if (Math.abs(moved) < OUTFIT_PAGER.COMMIT_RATIO) return gesture.origin;

      return moved > 0 ? Math.ceil(pos) : Math.floor(pos);
    }

    const offset = pos - gesture.origin;
    const whole = Math.trunc(offset);
    const rest = offset - whole;

    return (
      gesture.origin +
      whole +
      (Math.abs(rest) >= OUTFIT_PAGER.COMMIT_RATIO ? Math.sign(rest) : 0)
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture?.pointerId !== event.pointerId) return;

    gestureRef.current = null;

    if (gesture.axis !== 'y' || gesture.isAbandoned) return;

    followPointer(gesture, event.clientY);

    const max = layerCountRef.current - 1;
    const velocity = getVelocity(gesture.samples, event.timeStamp);
    const target = clamp(getReleaseTarget(gesture, velocity), 0, max);
    const isPullingPastEdge =
      (posRef.current < 0 && velocity < 0) ||
      (posRef.current > max && velocity > 0);

    velocityRef.current = isPullingPastEdge
      ? 0
      : velocity / getSpacing(presenceRef.current);
    commit(target);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture?.pointerId !== event.pointerId) return;

    gestureRef.current = null;

    if (gesture.axis === 'y' && !gesture.isAbandoned) {
      velocityRef.current = 0;
      commit(clamp(gesture.origin, 0, layerCountRef.current - 1));
    }
  };

  const registerLayerAt = useCallback((layerDepth: number) => {
    const cached = layerRefCallbacksRef.current.get(layerDepth);

    if (cached) return cached;

    const register = (element: HTMLElement | null) => {
      if (element === null) return;

      layerElementsRef.current.set(layerDepth, element);

      return () => {
        if (layerElementsRef.current.get(layerDepth) === element) {
          layerElementsRef.current.delete(layerDepth);
        }
      };
    };

    layerRefCallbacksRef.current.set(layerDepth, register);

    return register;
  }, []);

  return {
    stackRef,
    registerLayerAt,
    nearest,
    range: isMoving ? movingRange : ([depth - 1, depth + 1] as const),
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
};

export default useOutfitPager;
