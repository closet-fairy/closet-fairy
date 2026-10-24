import { describe, expect, test } from 'vitest';
import {
  combineAngle,
  TILT_LIMIT,
  formatAngleInput,
  normalizeAngle,
  parseAngleInput,
  splitAngle,
} from './angle';

describe('각도 정규화', () => {
  test('소수 둘째 자리로 반올림해야 한다.', () => {
    expect(normalizeAngle(12.345)).toBe(12.35);
    expect(normalizeAngle(90 + 7.25)).toBe(97.25);
  });

  test('부동소수점 찌꺼기가 남지 않아야 한다.', () => {
    expect(normalizeAngle(0.1 + 0.2)).toBe(0.3);
  });

  test('범위를 넘는 각도는 같은 각도로 바꿔야 한다.', () => {
    expect(normalizeAngle(200)).toBe(-160);
    expect(normalizeAngle(-200)).toBe(160);
    expect(normalizeAngle(450)).toBe(90);
  });

  test('-180과 180은 180 하나로 맞춰야 한다.', () => {
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(540)).toBe(180);
  });

  test('반올림은 0에서 먼 쪽으로 대칭이어야 한다.', () => {
    expect(normalizeAngle(-12.345)).toBe(-12.35);
  });

  test('아주 큰 각도도 정확히 같은 각도로 바꿔야 한다.', () => {
    expect(normalizeAngle(1e20)).toBe(-80);
  });

  test('숫자가 아닌 값은 0이어야 한다.', () => {
    expect(normalizeAngle(Number.NaN)).toBe(0);
    expect(normalizeAngle(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test('-0은 0이어야 한다.', () => {
    expect(Object.is(normalizeAngle(-0), 0)).toBe(true);
    expect(Object.is(normalizeAngle(-0.001), 0)).toBe(true);
  });
});

describe('방향과 기울기 분해', () => {
  test('전체 각도를 90° 단위 방향과 -45°~45° 기울기로 나눠야 한다.', () => {
    expect(splitAngle(97)).toEqual({ quarterTurns: 1, tilt: 7 });
    expect(splitAngle(84)).toEqual({ quarterTurns: 1, tilt: -6 });
    expect(splitAngle(-6)).toEqual({ quarterTurns: 0, tilt: -6 });
    expect(splitAngle(180)).toEqual({ quarterTurns: 2, tilt: 0 });
  });

  test('정확히 45°면 방향 90°와 기울기 -45°로 나눠야 한다.', () => {
    expect(splitAngle(45)).toEqual({ quarterTurns: 1, tilt: -45 });
  });

  test('방향은 0~3 중 하나로 맞춰야 한다.', () => {
    expect(Object.is(splitAngle(-45).quarterTurns, 0)).toBe(true);
    expect(splitAngle(-90)).toEqual({ quarterTurns: 3, tilt: 0 });
    expect(splitAngle(179.99)).toEqual({ quarterTurns: 2, tilt: -0.01 });
    expect(splitAngle(-179.99)).toEqual({ quarterTurns: 2, tilt: 0.01 });
  });

  test('나눈 값을 다시 합치면 원래 각도여야 한다.', () => {
    [-179.99, -135, -45, -6, 0, 7.25, 45, 84, 97, 135, 180].forEach((angle) => {
      const { quarterTurns, tilt } = splitAngle(angle);

      expect(Math.abs(tilt)).toBeLessThanOrEqual(TILT_LIMIT);

      expect(combineAngle(quarterTurns, tilt)).toBe(normalizeAngle(angle));
    });
  });
});

describe('각도 입력 해석', () => {
  test('숫자와 부호, 소수를 해석해야 한다.', () => {
    expect(parseAngleInput('97')).toBe(97);
    expect(parseAngleInput('-12.5')).toBe(-12.5);
    expect(parseAngleInput('+3')).toBe(3);
    expect(parseAngleInput('.5')).toBe(0.5);
    expect(parseAngleInput(' 12 ')).toBe(12);
  });

  test('소수점이 쉼표로 들어와도 해석해야 한다.', () => {
    expect(parseAngleInput('12,5')).toBe(12.5);
  });

  test('끝이 소수점인 입력 중간 상태는 정수로 해석해야 한다.', () => {
    expect(parseAngleInput('12.')).toBe(12);
  });

  test('숫자로 읽을 수 없는 입력은 null이어야 한다.', () => {
    expect(parseAngleInput('')).toBeNull();
    expect(parseAngleInput('-')).toBeNull();
    expect(parseAngleInput('.')).toBeNull();
    expect(parseAngleInput('1-2')).toBeNull();
    expect(parseAngleInput('abc')).toBeNull();
  });
});

describe('각도 입력칸 표시', () => {
  test('정규화한 값을 불필요한 0 없이 보여 줘야 한다.', () => {
    expect(formatAngleInput(84)).toBe('84');
    expect(formatAngleInput(12.5)).toBe('12.5');
    expect(formatAngleInput(12.05)).toBe('12.05');
    expect(formatAngleInput(200)).toBe('-160');
  });
});
