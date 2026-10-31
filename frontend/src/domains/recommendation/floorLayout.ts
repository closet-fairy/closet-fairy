import type { OutfitItemResult } from '@/generated/models';
import {
  END_GAP_WEIGHT,
  FILL_WEIGHT,
  FLOOR_CARD,
  FLOOR_ITEM_GRADE,
  FLOW,
  FLOW_TIE,
  INVERSION_SLACK,
  INVERSION_WEIGHT,
  MAX_FLOOR_ITEMS,
  MAX_ROTATION,
  MAX_SCALE,
  MAX_SPARSE_BOOST,
  MIN_ACHIEVEMENT_WEIGHT,
  MIN_ROTATION_SHARE,
  PRIORITY,
  ROTATION_INSET,
  SPARSE_TARGET_AREA,
  STACK_ORDER,
  TARGET_AREA,
  VARIETY_TOLERANCE,
  WIDE_COLUMN_WEIGHT,
} from './floorLayout.constants';
import type { FloorItemGrade, FloorItemKind } from './floorLayout.constants';

export interface FloorItem {
  id: string;
  kind: FloorItemKind;
  ratio: number;
}

export interface FloorSeed {
  order: number;
  id: number;
}

export interface FloorPlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  stackOrder: number;
}

export interface FloorLayout {
  placements: FloorPlacement[];
  overflowCount: number;
}

type ColumnName = 'wide' | 'narrow';
type FloorTargets = Record<FloorItemGrade, number>;
type Row = number[];

interface Frame {
  lateColumn: ColumnName;
  stagger: number;
}

interface SizedItem {
  item: FloorItem;
  width: number;
  height: number;
  rowIndex: number;
}

interface SizedColumn {
  sizedItems: SizedItem[];
  totalHeight: number;
}

interface ColumnPlan extends SizedColumn {
  rowCount: number;
}

interface Candidate {
  score: number;
  mask: number;
  frame: Frame;
  wide: ColumnPlan;
  narrow: ColumnPlan;
}

const { width: CARD_WIDTH, height: CARD_HEIGHT, edge, gap } = FLOOR_CARD;
const FLOOR_BOTTOM = CARD_HEIGHT - FLOOR_CARD.reservedBottom;
const USABLE_WIDTH = CARD_WIDTH - edge * 2;
const USABLE_HEIGHT = FLOOR_BOTTOM - edge * 2;
const USABLE_BOTTOM = FLOOR_BOTTOM - edge;
const COLUMNS_WIDTH = USABLE_WIDTH - gap;
const WIDE_COLUMN_WIDTH = Math.round(
  COLUMNS_WIDTH * FLOOR_CARD.wideColumnShare,
);
const NARROW_COLUMN_WIDTH = COLUMNS_WIDTH - WIDE_COLUMN_WIDTH;
const MAX_COMMON_SCALE = Math.max(...Object.values(MAX_SCALE));
const SCALE_SEARCH_FLOOR = 0.01;
const SCALE_SEARCH_STEPS = 16;
const ROTATION_FIT_STEPS = 40;
const ROTATION_FIT_SHRINK = 0.85;

const getStaggerRange = (itemCount: number): [number, number] => {
  if (itemCount <= 4) return [56, 84];
  if (itemCount <= 6) return [36, 54];
  return [20, 34];
};

const hashSeed = (seed: number) => {
  let hash = 0x811c9dc5;

  for (const digit of String(seed)) {
    hash ^= digit.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

const createRandom = (seed: number) => {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const pickFloorItems = (items: readonly FloorItem[]) =>
  items
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        PRIORITY[left.item.kind] - PRIORITY[right.item.kind] ||
        left.index - right.index,
    )
    .slice(0, MAX_FLOOR_ITEMS)
    .map(({ item }) => item);

const sortHeadToToe = (items: readonly FloorItem[]) =>
  [...items].sort(
    (left, right) =>
      FLOW[left.kind] - FLOW[right.kind] ||
      FLOW_TIE[left.kind] - FLOW_TIE[right.kind],
  );

// 옷이 적으면 목표대로 놓아도 카드 가운데에 작게 남아서, 목표를 함께 키운다.
const getTargets = (items: readonly FloorItem[]): FloorTargets => {
  const totalTarget = items.reduce(
    (sum, { kind }) => sum + TARGET_AREA[FLOOR_ITEM_GRADE[kind]],
    0,
  );
  const boost = Math.min(
    Math.max(SPARSE_TARGET_AREA / totalTarget, 1),
    MAX_SPARSE_BOOST,
  );

  return {
    large: TARGET_AREA.large * boost,
    medium: TARGET_AREA.medium * boost,
    small: TARGET_AREA.small * boost,
  };
};

const getRowOptions = (sequence: readonly FloorItem[]) => {
  const options: Row[][] = [];

  const walk = (index: number, rows: Row[]) => {
    if (index >= sequence.length) {
      options.push(rows);
      return;
    }

    walk(index + 1, [...rows, [index]]);

    if (
      index + 1 < sequence.length &&
      FLOOR_ITEM_GRADE[sequence[index].kind] !== 'large' &&
      FLOOR_ITEM_GRADE[sequence[index + 1].kind] !== 'large'
    ) {
      walk(index + 2, [...rows, [index, index + 1]]);
    }
  };

  walk(0, []);

  return options;
};

const sizeRows = (
  sequence: readonly FloorItem[],
  rows: readonly Row[],
  columnWidth: number,
  commonScale: number,
  targets: FloorTargets,
): SizedColumn => {
  const sizedItems: SizedItem[] = [];
  let rowsHeight = 0;

  rows.forEach((row, rowIndex) => {
    const entries = row.map((itemIndex) => {
      const item = sequence[itemIndex];
      const grade = FLOOR_ITEM_GRADE[item.kind];
      const width = Math.min(
        Math.sqrt(targets[grade] * item.ratio) *
          Math.min(commonScale, MAX_SCALE[grade]),
        columnWidth,
      );

      return { item, width, height: width / item.ratio };
    });

    const entriesWidth = entries.reduce((sum, { width }) => sum + width, 0);
    const pairRoom = columnWidth - gap;

    if (entries.length === 2 && entriesWidth > pairRoom) {
      const shrink = pairRoom / entriesWidth;

      entries.forEach((entry) => {
        entry.width *= shrink;
        entry.height *= shrink;
      });
    }

    entries.forEach((entry) => sizedItems.push({ ...entry, rowIndex }));
    rowsHeight += Math.max(...entries.map(({ height }) => height));
  });

  return {
    sizedItems,
    totalHeight: rowsHeight + gap * Math.max(rows.length - 1, 0),
  };
};

const sizeColumn = (
  sequence: readonly FloorItem[],
  rows: readonly Row[],
  columnWidth: number,
  availableHeight: number,
  targets: FloorTargets,
): SizedColumn => {
  const sizeAt = (commonScale: number) =>
    sizeRows(sequence, rows, columnWidth, commonScale, targets);
  const largest = sizeAt(MAX_COMMON_SCALE);

  if (largest.totalHeight <= availableHeight) return largest;

  let fitting = SCALE_SEARCH_FLOOR;
  let overflowing = MAX_COMMON_SCALE;

  for (let step = 0; step < SCALE_SEARCH_STEPS; step += 1) {
    const middle = (fitting + overflowing) / 2;

    if (sizeAt(middle).totalHeight <= availableHeight) {
      fitting = middle;
    } else {
      overflowing = middle;
    }
  }

  return sizeAt(fitting);
};

const getRowTops = (column: ColumnPlan, top: number) => {
  const rowTops: number[] = [];
  let rowTop = top;

  for (let rowIndex = 0; rowIndex < column.rowCount; rowIndex += 1) {
    rowTops.push(rowTop);
    rowTop +=
      Math.max(
        0,
        ...column.sizedItems
          .filter((sized) => sized.rowIndex === rowIndex)
          .map(({ height }) => height),
      ) + gap;
  }

  return rowTops;
};

const countInversions = (cells: { kind: FloorItemKind; top: number }[]) => {
  let count = 0;

  cells.forEach((left, leftIndex) => {
    cells.slice(leftIndex + 1).forEach((right) => {
      if (FLOW[left.kind] === FLOW[right.kind]) return;

      const [upper, lower] =
        FLOW[left.kind] < FLOW[right.kind] ? [left, right] : [right, left];

      if (upper.top > lower.top + INVERSION_SLACK) count += 1;
    });
  });

  return count;
};

const scoreCandidate = (
  candidate: Omit<Candidate, 'score'>,
  targets: FloorTargets,
) => {
  const { frame, wide, narrow } = candidate;
  const sizedItems = [...wide.sizedItems, ...narrow.sizedItems];
  const areas = sizedItems.map(({ width, height }) => width * height);
  const achievements = sizedItems.map(({ item }, index) =>
    Math.min(areas[index] / targets[FLOOR_ITEM_GRADE[item.kind]], 1),
  );
  const meanAchievement =
    achievements.reduce((sum, value) => sum + value, 0) / achievements.length;
  const lowestAchievement = Math.min(...achievements);
  const fill =
    areas.reduce((sum, area) => sum + area, 0) / (USABLE_WIDTH * USABLE_HEIGHT);

  const wideTop = frame.lateColumn === 'wide' ? frame.stagger : 0;
  const narrowTop = frame.lateColumn === 'narrow' ? frame.stagger : 0;
  const wideRowTops = getRowTops(wide, wideTop);
  const narrowRowTops = getRowTops(narrow, narrowTop);
  const inversions = countInversions([
    ...wide.sizedItems.map(({ item, rowIndex }) => ({
      kind: item.kind,
      top: wideRowTops[rowIndex],
    })),
    ...narrow.sizedItems.map(({ item, rowIndex }) => ({
      kind: item.kind,
      top: narrowRowTops[rowIndex],
    })),
  ]);

  const largest = sizedItems.reduce((best, sized) =>
    sized.width * sized.height > best.width * best.height ? sized : best,
  );
  const isLargestInWide = wide.sizedItems.some(
    ({ item }) => item.id === largest.item.id,
  );

  const wideEnd = wideTop + wide.totalHeight;
  const narrowEnd = narrowTop + narrow.totalHeight;
  const endGap =
    wideEnd <= 0 || narrowEnd <= 0
      ? Number.MAX_SAFE_INTEGER
      : Math.max(wideEnd, narrowEnd) / Math.min(wideEnd, narrowEnd);

  return (
    meanAchievement +
    MIN_ACHIEVEMENT_WEIGHT * lowestAchievement -
    INVERSION_WEIGHT * inversions -
    (isLargestInWide ? 0 : WIDE_COLUMN_WEIGHT) -
    END_GAP_WEIGHT * (endGap - 1) +
    FILL_WEIGHT * fill
  );
};

const buildCandidates = (
  sequence: readonly FloorItem[],
  stagger: number,
  targets: FloorTargets,
) => {
  const frames: Frame[] = [
    { lateColumn: 'wide', stagger },
    { lateColumn: 'narrow', stagger },
  ];
  const sizedColumns = new Map<string, SizedColumn>();

  const getColumnPlan = (
    columnSequence: readonly FloorItem[],
    rows: readonly Row[],
    column: ColumnName,
    mask: number,
    availableHeight: number,
  ): ColumnPlan => {
    const rowsKey = rows.map((row) => row.join('+')).join('/');
    const key = `${column}|${mask}|${availableHeight}|${rowsKey}`;
    const columnWidth =
      column === 'wide' ? WIDE_COLUMN_WIDTH : NARROW_COLUMN_WIDTH;
    const sized =
      sizedColumns.get(key) ??
      sizeColumn(columnSequence, rows, columnWidth, availableHeight, targets);

    sizedColumns.set(key, sized);

    return { ...sized, rowCount: rows.length };
  };

  const candidates: Candidate[] = [];

  for (let mask = 0; mask < 1 << sequence.length; mask += 1) {
    const wideSequence = sequence.filter((_, index) => !(mask & (1 << index)));
    const narrowSequence = sequence.filter((_, index) => mask & (1 << index));
    const isSingleColumn = sequence.length === 1;

    if (
      wideSequence.length === 0 ||
      (narrowSequence.length === 0 && !isSingleColumn)
    ) {
      continue;
    }

    const wideRowOptions = getRowOptions(wideSequence);
    const narrowRowOptions = getRowOptions(narrowSequence);

    frames.forEach((frame) => {
      const wideHeight =
        USABLE_HEIGHT - (frame.lateColumn === 'wide' ? frame.stagger : 0);
      const narrowHeight =
        USABLE_HEIGHT - (frame.lateColumn === 'narrow' ? frame.stagger : 0);

      wideRowOptions.forEach((wideRows) => {
        const wide = getColumnPlan(
          wideSequence,
          wideRows,
          'wide',
          mask,
          wideHeight,
        );

        narrowRowOptions.forEach((narrowRows) => {
          const narrow = getColumnPlan(
            narrowSequence,
            narrowRows,
            'narrow',
            mask,
            narrowHeight,
          );
          const candidate = { mask, frame, wide, narrow };

          candidates.push({
            ...candidate,
            score: scoreCandidate(candidate, targets),
          });
        });
      });
    });
  }

  return candidates;
};

const chooseCandidate = (candidates: Candidate[], random: () => number) => {
  const bestScore = Math.max(...candidates.map(({ score }) => score));
  const nearBest = candidates
    .filter(({ score }) => score >= bestScore - VARIETY_TOLERANCE)
    .sort((left, right) => right.score - left.score || left.mask - right.mask);

  return nearBest[Math.floor(random() * nearBest.length)];
};

const fitRotation = (placement: FloorPlacement, angle: number) => {
  const { x, y, width, height } = placement;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  let fitted = angle;

  for (let step = 0; step < ROTATION_FIT_STEPS; step += 1) {
    const radian = Math.abs(fitted) * (Math.PI / 180);
    const halfWidth =
      (width * Math.cos(radian) + height * Math.sin(radian)) / 2;
    const halfHeight =
      (width * Math.sin(radian) + height * Math.cos(radian)) / 2;
    const isInside =
      centerX - halfWidth >= ROTATION_INSET &&
      centerX + halfWidth <= CARD_WIDTH - ROTATION_INSET &&
      centerY - halfHeight >= ROTATION_INSET &&
      centerY + halfHeight <= FLOOR_BOTTOM;

    if (isInside) return fitted;

    fitted *= ROTATION_FIT_SHRINK;
  }

  return 0;
};

const placeColumn = (
  column: ColumnPlan,
  columnX: number,
  columnWidth: number,
  top: number,
  isLeftColumn: boolean,
) => {
  const rowTops = getRowTops(column, top);

  return rowTops.flatMap((rowTop, rowIndex) => {
    const row = column.sizedItems.filter(
      (sized) => sized.rowIndex === rowIndex,
    );
    const rowWidth =
      row.reduce((sum, { width }) => sum + width, 0) + gap * (row.length - 1);
    const rowHeight = Math.max(...row.map(({ height }) => height));
    let x = isLeftColumn ? columnX + columnWidth - rowWidth : columnX;

    return row.map(({ item, width, height }): FloorPlacement => {
      const placement = {
        id: item.id,
        x,
        y: rowTop + (rowHeight - height) / 2,
        width,
        height,
        rotation: 0,
        stackOrder: STACK_ORDER[item.kind],
      };

      x += width + gap;

      return placement;
    });
  });
};

const placeCandidate = (candidate: Candidate, isWideLeft: boolean) => {
  const { frame, wide, narrow } = candidate;
  const wideX = isWideLeft ? edge : CARD_WIDTH - edge - WIDE_COLUMN_WIDTH;
  const narrowX = isWideLeft ? edge + WIDE_COLUMN_WIDTH + gap : edge;
  const wideTop = edge + (frame.lateColumn === 'wide' ? frame.stagger : 0);
  const narrowTop = edge + (frame.lateColumn === 'narrow' ? frame.stagger : 0);
  const columnEnds = [
    wideTop + wide.totalHeight,
    ...(narrow.sizedItems.length > 0 ? [narrowTop + narrow.totalHeight] : []),
  ];
  const shift = Math.max(0, USABLE_BOTTOM - Math.max(...columnEnds)) / 2;

  return [
    ...placeColumn(wide, wideX, WIDE_COLUMN_WIDTH, wideTop + shift, isWideLeft),
    ...placeColumn(
      narrow,
      narrowX,
      NARROW_COLUMN_WIDTH,
      narrowTop + shift,
      !isWideLeft,
    ),
  ];
};

const rotatePlacements = (
  placements: readonly FloorPlacement[],
  random: () => number,
) => {
  let sign = random() < 0.5 ? -1 : 1;
  const rotations = new Map<string, number>();

  [...placements]
    .sort((upper, lower) => upper.y - lower.y)
    .forEach((placement) => {
      const share = MIN_ROTATION_SHARE + random() * (1 - MIN_ROTATION_SHARE);

      rotations.set(
        placement.id,
        fitRotation(placement, sign * MAX_ROTATION * share),
      );
      sign = -sign;
    });

  return placements.map((placement) => ({
    ...placement,
    rotation: rotations.get(placement.id) ?? 0,
  }));
};

const centerSinglePlacement = (placements: FloorPlacement[]) =>
  placements.length === 1
    ? [{ ...placements[0], x: (CARD_WIDTH - placements[0].width) / 2 }]
    : placements;

export const getFloorItemKind = (
  item: Pick<OutfitItemResult, 'slot_cd' | 'accessory_type_cd'>,
): FloorItemKind =>
  item.slot_cd === 'accessories'
    ? (item.accessory_type_cd ?? 'etc')
    : item.slot_cd;

export const layoutFloor = (
  items: readonly FloorItem[],
  seed: FloorSeed,
): FloorLayout => {
  if (items.length === 0) return { placements: [], overflowCount: 0 };

  const floorItems = pickFloorItems(items);
  const sequence = sortHeadToToe(floorItems);
  const random = createRandom(hashSeed(seed.id));
  const [minStagger, maxStagger] = getStaggerRange(sequence.length);
  const stagger = Math.round(minStagger + random() * (maxStagger - minStagger));
  const candidates = buildCandidates(sequence, stagger, getTargets(sequence));
  const chosen = chooseCandidate(candidates, random);
  const isWideLeft = seed.order % 2 === 1;

  return {
    placements: rotatePlacements(
      centerSinglePlacement(placeCandidate(chosen, isWideLeft)),
      random,
    ),
    overflowCount: items.length - floorItems.length,
  };
};
