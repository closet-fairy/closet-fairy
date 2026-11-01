import type { FloorPlacement } from './floorLayout';
import { FLOOR_CARD } from './floorLayout.constants';

export const FLOOR_ENTRANCE = {
  duration: 400,
  stagger: 80,
  totalLimit: 1000,
} as const;

const ROW_TOLERANCE = FLOOR_CARD.height * 0.14;

interface FloorEntranceSchedule {
  delays: Map<string, number>;
  totalMs: number;
}

const sortByPosition = (placements: readonly FloorPlacement[]) => {
  const centers = placements
    .map(({ id, x, y, width, height }) => ({
      id,
      centerX: x + width / 2,
      centerY: y + height / 2,
    }))
    .sort((a, b) => a.centerY - b.centerY);
  const rows: (typeof centers)[] = [];

  centers.forEach((center) => {
    const row = rows.at(-1);

    if (row && center.centerY - row[0].centerY <= ROW_TOLERANCE) {
      row.push(center);
    } else {
      rows.push([center]);
    }
  });

  return rows.flatMap((row) => row.sort((a, b) => a.centerX - b.centerX));
};

export const getFloorEntranceSchedule = (
  placements: readonly FloorPlacement[],
): FloorEntranceSchedule => {
  const { duration, stagger, totalLimit } = FLOOR_ENTRANCE;
  const gap =
    placements.length > 1
      ? Math.min(stagger, (totalLimit - duration) / (placements.length - 1))
      : 0;
  const delays = new Map(
    sortByPosition(placements).map(({ id }, index) => [
      id,
      Math.round(index * gap),
    ]),
  );

  return {
    delays,
    totalMs: duration + Math.max(0, ...delays.values()),
  };
};
