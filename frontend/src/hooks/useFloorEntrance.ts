import { useEffect, useEffectEvent, useState } from 'react';
import { getFloorEntranceSchedule } from '@/domains/recommendation/floorEntrance';
import type { FloorPlacement } from '@/domains/recommendation/floorLayout';
import isReducedMotion from '@/utils/isReducedMotion';

export interface FloorEntranceOption {
  isActive: boolean;
  onPlay?: () => void;
}

type EntrancePhase = 'waiting' | 'playing' | 'done';

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
  } else if (phase === 'waiting' && entrance === undefined) {
    setPhase('done');
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
