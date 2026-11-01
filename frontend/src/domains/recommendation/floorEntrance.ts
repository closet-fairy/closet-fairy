import type { FloorPlacement } from './floorLayout';
import { FLOOR_CARD } from './floorLayout.constants';

export const FLOOR_ENTRANCE = {
  duration: 400,
  stagger: 80,
  totalLimit: 1000,
} as const;

// 두 열이 엇갈려 놓여 있어서 중심 높이가 조금 달라도 한 줄로 본다.
const ROW_TOLERANCE = FLOOR_CARD.height * 0.14;

interface FloorEntranceSchedule {
  delays: Map<string, number>;
  totalMs: number;
}

/*
 * 배치 좌표로 줄을 나눠 위 왼쪽 → 위 오른쪽 → 아래 왼쪽 → 아래 오른쪽 순서로 정렬한다.
 * 줄의 기준은 줄에서 가장 위에 있는 옷의 중심 높이다.
 */
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

// 옷이 많아도 전체가 상한 안에 끝나도록 간격을 줄인다.
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
