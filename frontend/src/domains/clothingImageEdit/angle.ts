export const TILT_LIMIT = 45;
const QUARTER_TURN = 90;
const FULL_TURN = 360;
const HALF_TURN = 180;

const roundToHundredths = (value: number) =>
  (Math.sign(value) * Math.round(Math.abs(value) * 100)) / 100;

const wrapToHalfTurn = (value: number) =>
  ((((value + HALF_TURN) % FULL_TURN) + FULL_TURN) % FULL_TURN) - HALF_TURN;

// BE는 -180~180, 소수 둘째 자리까지 받는다. 같은 각도는 -180 초과 180 이하 하나로 맞춘다.
export const normalizeAngle = (angle: number) => {
  if (!Number.isFinite(angle)) {
    return 0;
  }

  const rounded = roundToHundredths(wrapToHalfTurn(angle % FULL_TURN));
  const wrapped = roundToHundredths(wrapToHalfTurn(rounded));
  const result = wrapped === -HALF_TURN ? HALF_TURN : wrapped;

  return result === 0 ? 0 : result;
};

export const normalizeQuarterTurns = (quarterTurns: number) =>
  ((Math.round(quarterTurns) % 4) + 4) % 4;

export interface SplitAngle {
  quarterTurns: number;
  tilt: number;
}

/*
 * 편집기는 방향과 기울기를 따로 상태로 들고, 이 함수는 저장된 값을 불러오거나 각도를 입력할 때만 쓴다.
 * 매번 전체 각도에서 다시 나누면 기울기 45°가 방향 90°와 기울기 -45°로 바뀌어 슬라이더가 튄다.
 */
export const splitAngle = (angle: number): SplitAngle => {
  const normalized = normalizeAngle(angle);
  const rawQuarterTurns = Math.round(normalized / QUARTER_TURN);
  const tilt = roundToHundredths(normalized - rawQuarterTurns * QUARTER_TURN);

  return {
    quarterTurns: normalizeQuarterTurns(rawQuarterTurns),
    tilt: tilt === 0 ? 0 : tilt,
  };
};

export const combineAngle = (quarterTurns: number, tilt: number) =>
  normalizeAngle(quarterTurns * QUARTER_TURN + tilt);

const ANGLE_INPUT_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

export const parseAngleInput = (text: string) => {
  const normalizedText = text.trim().replace(',', '.');

  if (!ANGLE_INPUT_PATTERN.test(normalizedText)) {
    return null;
  }

  const value = Number(normalizedText);

  return Number.isFinite(value) ? value : null;
};

export const formatAngleInput = (angle: number) => {
  const normalized = normalizeAngle(angle);

  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(2).replace(/0$/, '');
};
