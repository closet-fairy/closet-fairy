import { useEffect, useEffectEvent, useState } from 'react';
import { getFloorEntranceSchedule } from '@/domains/recommendation/floorEntrance';
import type { FloorPlacement } from '@/domains/recommendation/floorLayout';
import isReducedMotion from '@/utils/isReducedMotion';

export interface FloorEntranceOption {
  /** 사용자가 지금 보고 있는 자리인지. 보게 되기 전에는 옷을 숨겨 둔다. */
  isActive: boolean;
  onPlay?: () => void;
}

type EntrancePhase = 'waiting' | 'playing' | 'done';

/*
 * 등장 여부는 처음 그려질 때 한 번만 정한다.
 * 이미 본 코디가 다시 그려져도 처음 정한 대로 이어 가고, 재생이 끝나면 더는 개입하지 않는다.
 */
const useFloorEntrance = (
  entrance: FloorEntranceOption | undefined,
  placements: readonly FloorPlacement[],
  isSettled: boolean,
) => {
  const [phase, setPhase] = useState<EntrancePhase>(() =>
    entrance !== undefined && !isReducedMotion() ? 'waiting' : 'done',
  );
  const { delays, totalMs } = getFloorEntranceSchedule(placements);
  const notifyPlay = useEffectEvent(() => entrance?.onPlay?.());

  if (
    phase === 'waiting' &&
    entrance?.isActive === true &&
    isSettled &&
    placements.length > 0
  ) {
    setPhase('playing');
  }

  useEffect(() => {
    if (phase === 'playing') {
      notifyPlay();
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const timer = setTimeout(() => setPhase('done'), totalMs);

    return () => clearTimeout(timer);
  }, [phase, totalMs]);

  return {
    phase,
    getDelay: (id: string) => delays.get(id) ?? 0,
  };
};

export default useFloorEntrance;
