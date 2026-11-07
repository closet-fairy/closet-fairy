/*
 * 추천 중 화면의 옷 아이콘과 요술봉 위치 표를 만든다.
 *
 *   node scripts/computeClothesWandLayout.ts
 *
 * Material Symbols SVG 경로를 촘촘히 쪼갠 점들로 옷이 실제로 그려진 범위와 대각선 끝점을 구한다.
 * 규칙은 추천 중 구현 지시서의 "위치 규칙"을 따른다.
 *   1. 옷은 오른쪽 아래로 가장 튀어나온 점(x+y 최대), 좌우 반전한 요술봉은 별 끝(x+y 최소)을 기준점으로 삼는다.
 *   2. 별 끝을 옷의 기준점에서 대각선(↘)으로 GAP만큼 띄운다.
 *   3. 옷과 요술봉이 실제로 그려진 부분을 합친 범위의 중심을 190 상자 중심에 맞춘다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const BOX_SIZE = 190;
const CLOTHES_SIZE = 80;
const WAND_SIZE = 36;
const DEFAULT_GAP = 3;
const GAP_BY_CLOTHES: Record<string, number> = { steps: 1, eyeglasses: 5 };
const CLOTHES_NAMES = [
  'apparel',
  'dry_cleaning',
  'steps',
  'shopping_bag',
  'eyeglasses',
  'watch',
] as const;
const WAND_NAME = 'wand_stars';
const VIEW_BOX_SIZE = 960;
const CURVE_STEPS = 400;
const FRACTION_DIGITS = 2;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..');
const svgDir = resolve(
  frontendDir,
  'node_modules/@material-symbols/svg-400/outlined',
);
const outputPath = resolve(
  frontendDir,
  'src/pages/RecommendationProgress/components/ClothesWandVisual/ClothesWandVisual.layout.ts',
);

const readPathData = (name: string) => {
  const svg = readFileSync(resolve(svgDir, `${name}.svg`), 'utf8');
  const match = svg.match(/<path d="([^"]+)"/);

  if (match === null) {
    throw new Error(`${name}.svg에서 경로를 찾지 못했습니다.`);
  }

  return match[1];
};

const COMMAND_PARAMETER_COUNT: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  z: 0,
};

/*
 * 경로를 점으로 쪼갠다. 점 좌표는 viewBox 기준(x는 0~960, y는 -960~0)이다.
 * Material Symbols 경로가 쓰는 M, L, H, V, C, S, Q, T, Z만 다룬다.
 */
const flattenPath = (pathData: string) => {
  const tokens = pathData.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const points: Point[] = [];
  let index = 0;
  let command = '';
  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };
  let lastCubicControl: Point | null = null;
  let lastQuadraticControl: Point | null = null;

  const readNumbers = (count: number) => {
    const values: number[] = [];

    for (let i = 0; i < count; i += 1) {
      values.push(Number(tokens[index]));
      index += 1;
    }

    return values;
  };

  const sampleCubic = (p0: Point, p1: Point, p2: Point, p3: Point) => {
    for (let step = 1; step <= CURVE_STEPS; step += 1) {
      const t = step / CURVE_STEPS;
      const u = 1 - t;
      points.push({
        x:
          u ** 3 * p0.x +
          3 * u ** 2 * t * p1.x +
          3 * u * t ** 2 * p2.x +
          t ** 3 * p3.x,
        y:
          u ** 3 * p0.y +
          3 * u ** 2 * t * p1.y +
          3 * u * t ** 2 * p2.y +
          t ** 3 * p3.y,
      });
    }
  };

  const sampleQuadratic = (p0: Point, p1: Point, p2: Point) => {
    for (let step = 1; step <= CURVE_STEPS; step += 1) {
      const t = step / CURVE_STEPS;
      const u = 1 - t;
      points.push({
        x: u ** 2 * p0.x + 2 * u * t * p1.x + t ** 2 * p2.x,
        y: u ** 2 * p0.y + 2 * u * t * p1.y + t ** 2 * p2.y,
      });
    }
  };

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) {
      command = tokens[index];
      index += 1;

      if (command === 'z' || command === 'Z') {
        current = subpathStart;
        lastCubicControl = null;
        lastQuadraticControl = null;
        continue;
      }
    }

    const lower = command.toLowerCase();
    const parameterCount = COMMAND_PARAMETER_COUNT[lower];

    if (parameterCount === undefined) {
      throw new Error(`지원하지 않는 경로 명령입니다: ${command}`);
    }

    const isRelative = command === lower;
    const values = readNumbers(parameterCount);
    const originX = isRelative ? current.x : 0;
    const originY = isRelative ? current.y : 0;
    let nextCubicControl: Point | null = null;
    let nextQuadraticControl: Point | null = null;

    if (lower === 'm') {
      current = { x: originX + values[0], y: originY + values[1] };
      subpathStart = current;
      points.push(current);
      // 첫 쌍 뒤에 이어지는 좌표쌍은 선분(L)으로 본다.
      command = isRelative ? 'l' : 'L';
    } else if (lower === 'l') {
      current = { x: originX + values[0], y: originY + values[1] };
      points.push(current);
    } else if (lower === 'h') {
      current = { x: originX + values[0], y: current.y };
      points.push(current);
    } else if (lower === 'v') {
      current = { x: current.x, y: originY + values[0] };
      points.push(current);
    } else if (lower === 'c') {
      const p1 = { x: originX + values[0], y: originY + values[1] };
      const p2 = { x: originX + values[2], y: originY + values[3] };
      const p3 = { x: originX + values[4], y: originY + values[5] };
      sampleCubic(current, p1, p2, p3);
      nextCubicControl = p2;
      current = p3;
    } else if (lower === 's') {
      const p1: Point =
        lastCubicControl === null
          ? current
          : {
              x: 2 * current.x - lastCubicControl.x,
              y: 2 * current.y - lastCubicControl.y,
            };
      const p2 = { x: originX + values[0], y: originY + values[1] };
      const p3 = { x: originX + values[2], y: originY + values[3] };
      sampleCubic(current, p1, p2, p3);
      nextCubicControl = p2;
      current = p3;
    } else if (lower === 'q') {
      const p1 = { x: originX + values[0], y: originY + values[1] };
      const p2 = { x: originX + values[2], y: originY + values[3] };
      sampleQuadratic(current, p1, p2);
      nextQuadraticControl = p1;
      current = p2;
    } else if (lower === 't') {
      const p1: Point =
        lastQuadraticControl === null
          ? current
          : {
              x: 2 * current.x - lastQuadraticControl.x,
              y: 2 * current.y - lastQuadraticControl.y,
            };
      const p2 = { x: originX + values[0], y: originY + values[1] };
      sampleQuadratic(current, p1, p2);
      nextQuadraticControl = p1;
      current = p2;
    }

    lastCubicControl = nextCubicControl;
    lastQuadraticControl = nextQuadraticControl;
  }

  return points;
};

/* viewBox 좌표를 size 픽셀 상자 안의 좌표로 바꾼다. 좌우 반전은 상자 가운데를 기준으로 한다. */
const toBoxPoints = (points: Point[], size: number, isMirrored: boolean) =>
  points.map(({ x, y }) => {
    const boxX = (x / VIEW_BOX_SIZE) * size;

    return {
      x: isMirrored ? size - boxX : boxX,
      y: ((y + VIEW_BOX_SIZE) / VIEW_BOX_SIZE) * size,
    };
  });

const getBounds = (points: Point[]): Bounds => ({
  x0: Math.min(...points.map(({ x }) => x)),
  y0: Math.min(...points.map(({ y }) => y)),
  x1: Math.max(...points.map(({ x }) => x)),
  y1: Math.max(...points.map(({ y }) => y)),
});

const pickByDiagonal = (points: Point[], isFarthest: boolean) =>
  points.reduce((best, point) => {
    const isBetter = isFarthest
      ? point.x + point.y > best.x + best.y
      : point.x + point.y < best.x + best.y;

    return isBetter ? point : best;
  });

const round = (value: number) => Number(value.toFixed(FRACTION_DIGITS));

const wandPoints = toBoxPoints(
  flattenPath(readPathData(WAND_NAME)),
  WAND_SIZE,
  true,
);
const wandBounds = getBounds(wandPoints);
const wandTip = pickByDiagonal(wandPoints, false);

const layouts = CLOTHES_NAMES.map((name) => {
  const clothesPoints = toBoxPoints(
    flattenPath(readPathData(name)),
    CLOTHES_SIZE,
    false,
  );
  const clothesBounds = getBounds(clothesPoints);
  const anchor = pickByDiagonal(clothesPoints, true);
  const gap = GAP_BY_CLOTHES[name] ?? DEFAULT_GAP;
  const wandLeft = anchor.x + gap - wandTip.x;
  const wandTop = anchor.y + gap - wandTip.y;
  const unionX0 = Math.min(clothesBounds.x0, wandLeft + wandBounds.x0);
  const unionY0 = Math.min(clothesBounds.y0, wandTop + wandBounds.y0);
  const unionX1 = Math.max(clothesBounds.x1, wandLeft + wandBounds.x1);
  const unionY1 = Math.max(clothesBounds.y1, wandTop + wandBounds.y1);
  const offsetX = BOX_SIZE / 2 - (unionX0 + unionX1) / 2;
  const offsetY = BOX_SIZE / 2 - (unionY0 + unionY1) / 2;

  return {
    name,
    clothes: { left: round(offsetX), top: round(offsetY) },
    wand: { left: round(offsetX + wandLeft), top: round(offsetY + wandTop) },
    tip: {
      x: round(offsetX + wandLeft + wandTip.x),
      y: round(offsetY + wandTop + wandTip.y),
    },
  };
});

const body = layouts
  .map(
    ({ name, clothes, wand, tip }) => `  ${name}: {
    clothes: { left: ${clothes.left}, top: ${clothes.top} },
    wand: { left: ${wand.left}, top: ${wand.top} },
    tip: { x: ${tip.x}, y: ${tip.y} },
  },`,
  )
  .join('\n');

writeFileSync(
  outputPath,
  `/*
 * scripts/computeClothesWandLayout.ts가 만든 파일이다. 직접 고치지 않는다.
 * 값은 ${BOX_SIZE}px 상자의 왼쪽 위를 원점으로 하는 px이다.
 *   clothes: ${CLOTHES_SIZE}px 옷 아이콘 상자의 left, top
 *   wand: ${WAND_SIZE}px 요술봉 상자의 left, top (좌우 반전 전 상자 기준)
 *   tip: 좌우 반전한 요술봉의 별 끝 좌표
 */
export const LAYOUT_BOX_SIZE = ${BOX_SIZE};
export const LAYOUT_CLOTHES_SIZE = ${CLOTHES_SIZE};
export const LAYOUT_WAND_SIZE = ${WAND_SIZE};

export const CLOTHES_WAND_LAYOUTS = {
${body}
} as const;
`,
);

console.log(`${layouts.length}개 옷의 위치를 ${outputPath}에 썼습니다.`);
