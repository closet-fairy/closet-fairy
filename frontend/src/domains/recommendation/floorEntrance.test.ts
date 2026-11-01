import { describe, expect, test } from 'vitest';
import { FLOOR_ENTRANCE, getFloorEntranceSchedule } from './floorEntrance';
import type { FloorPlacement } from './floorLayout';

const createPlacement = (id: string, x: number, y: number): FloorPlacement => ({
  id,
  x,
  y,
  width: 100,
  height: 100,
  rotation: 0,
  stackOrder: 1,
});

const createGrid = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    createPlacement(
      `item-${index}`,
      (index % 2) * 160,
      Math.floor(index / 2) * 120,
    ),
  );

const getOrder = (placements: readonly FloorPlacement[]) =>
  [...getFloorEntranceSchedule(placements).delays]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);

describe('등장 순서', () => {
  test('위 왼쪽, 위 오른쪽, 아래 왼쪽, 아래 오른쪽 순서여야 한다.', () => {
    const placements = [
      createPlacement('bottom-right', 160, 240),
      createPlacement('top-right', 160, 0),
      createPlacement('bottom-left', 0, 240),
      createPlacement('top-left', 0, 0),
    ];

    expect(getOrder(placements)).toEqual([
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ]);
  });

  test('중심 높이가 조금 달라도 같은 줄이면 왼쪽부터 나와야 한다.', () => {
    const placements = [
      createPlacement('right', 160, 0),
      createPlacement('left', 0, 40),
      createPlacement('below', 0, 200),
    ];

    expect(getOrder(placements)).toEqual(['left', 'right', 'below']);
  });
});

describe('등장 간격', () => {
  test('옷이 적으면 정해 둔 간격으로 이어서 나와야 한다.', () => {
    const { delays, totalMs } = getFloorEntranceSchedule(createGrid(4));

    expect([...delays.values()]).toEqual([0, 80, 160, 240]);
    expect(totalMs).toBe(FLOOR_ENTRANCE.duration + 240);
  });

  test('옷이 많아도 전체가 상한을 넘지 않도록 간격을 줄여야 한다.', () => {
    const { totalMs } = getFloorEntranceSchedule(createGrid(10));

    expect(totalMs).toBeLessThanOrEqual(FLOOR_ENTRANCE.totalLimit);
  });

  test('한 벌이면 기다림 없이 바로 나와야 한다.', () => {
    const { delays, totalMs } = getFloorEntranceSchedule(createGrid(1));

    expect([...delays.values()]).toEqual([0]);
    expect(totalMs).toBe(FLOOR_ENTRANCE.duration);
  });

  test('놓을 옷이 없으면 한 벌 길이만 돌려줘야 한다.', () => {
    expect(getFloorEntranceSchedule([]).totalMs).toBe(FLOOR_ENTRANCE.duration);
  });
});
