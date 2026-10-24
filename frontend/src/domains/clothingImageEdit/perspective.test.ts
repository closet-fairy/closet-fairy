import { describe, expect, test } from 'vitest';
import type { Quad } from './types';
import {
  applyTransform,
  DEFAULT_CORNERS,
  getPerspectiveOutputSize,
  getPerspectiveTransform,
  isDefaultCorners,
  isValidQuad,
  snapCorners,
  toPerspectiveParam,
} from './perspective';

const SIZE = { width: 1000, height: 2000 };

describe('원근 미적용 판정', () => {
  test('귀퉁이 그대로면 원근을 쓰지 않은 것이어야 한다.', () => {
    expect(isDefaultCorners(DEFAULT_CORNERS)).toBe(true);
  });

  test('귀퉁이에서 0.1% 이내로만 움직였으면 원근을 쓰지 않은 것이어야 한다.', () => {
    expect(
      isDefaultCorners([
        [0.0005, 0],
        [1, 0.001],
        [1, 1],
        [0, 1],
      ]),
    ).toBe(true);
  });

  test('귀퉁이에서 0.1%보다 많이 움직였으면 원근을 쓴 것이어야 한다.', () => {
    expect(
      isDefaultCorners([
        [0.002, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toBe(false);
  });
});

describe('저장할 원근 값', () => {
  test('기본값으로 볼 만큼 가까우면 null이어야 한다.', () => {
    expect(
      toPerspectiveParam([
        [0.0005, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toBeNull();
  });

  test('원근을 쓰면 꼭짓점 네 개를 그대로 담아야 한다.', () => {
    expect(
      toPerspectiveParam([
        [0.1, 0],
        [0.9, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toEqual({
      corners: [
        [0.1, 0],
        [0.9, 0],
        [1, 1],
        [0, 1],
      ],
    });
  });

  test('렌더링용 꼭짓점도 같은 기준으로 기본값에 붙여야 한다.', () => {
    expect(
      snapCorners([
        [0.0005, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toBe(DEFAULT_CORNERS);
  });

  test('1에서 0.1% 떨어진 귀퉁이도 기본값으로 봐야 한다.', () => {
    expect(
      isDefaultCorners([
        [0.001, 0],
        [1, 0],
        [0.999, 1],
        [0, 1],
      ]),
    ).toBe(true);
  });
});

describe('원근 결과 크기', () => {
  test('기본 꼭짓점이면 원래 크기여야 한다.', () => {
    expect(getPerspectiveOutputSize(DEFAULT_CORNERS, SIZE)).toEqual(SIZE);
  });

  test('비율이 아니라 픽셀 길이의 평균으로 재야 한다.', () => {
    const corners: Quad = [
      [0.1, 0],
      [0.9, 0],
      [1, 1],
      [0, 1],
    ];

    // 윗변 800px, 아랫변 1000px, 양옆 변은 각각 √(100² + 2000²)px다.
    expect(getPerspectiveOutputSize(corners, SIZE)).toEqual({
      width: 900,
      height: 2002,
    });
  });
});

describe('사각형 유효성', () => {
  test('기본 꼭짓점은 올바른 사각형이어야 한다.', () => {
    expect(isValidQuad(DEFAULT_CORNERS, SIZE)).toBe(true);
  });

  test('볼록한 사다리꼴은 올바른 사각형이어야 한다.', () => {
    expect(
      isValidQuad(
        [
          [0.2, 0.1],
          [0.8, 0.05],
          [0.95, 0.9],
          [0.05, 0.95],
        ],
        SIZE,
      ),
    ).toBe(true);
  });

  test('반시계 방향 순서의 사각형은 막아야 한다.', () => {
    expect(
      isValidQuad(
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
        ],
        SIZE,
      ),
    ).toBe(false);
  });

  test('사진 밖으로 나간 꼭짓점은 막아야 한다.', () => {
    expect(
      isValidQuad(
        [
          [-0.01, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        SIZE,
      ),
    ).toBe(false);
  });

  test('변이 교차해 꼬인 사각형은 막아야 한다.', () => {
    expect(
      isValidQuad(
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        SIZE,
      ),
    ).toBe(false);
  });

  test('오목한 사각형은 막아야 한다.', () => {
    expect(
      isValidQuad(
        [
          [0, 0],
          [1, 0],
          [0.3, 0.3],
          [0, 1],
        ],
        SIZE,
      ),
    ).toBe(false);
  });

  test('변이 짧은 변의 10%보다 짧으면 막아야 한다.', () => {
    expect(
      isValidQuad(
        [
          [0.5, 0.5],
          [0.55, 0.5],
          [0.55, 0.55],
          [0.5, 0.55],
        ],
        SIZE,
      ),
    ).toBe(false);
  });
});

describe('원근 변환 행렬', () => {
  test('네 점을 정확히 목표 네 점으로 옮겨야 한다.', () => {
    const from: Quad = [
      [30, 46],
      [238, 30],
      [248, 318],
      [16, 300],
    ];
    const to: Quad = [
      [0, 0],
      [220, 0],
      [220, 280],
      [0, 280],
    ];
    const transform = getPerspectiveTransform(from, to);

    expect(transform).not.toBeNull();
    if (transform === null) {
      return;
    }

    from.forEach((point, index) => {
      const [x, y] = applyTransform(transform, point);

      expect(x).toBeCloseTo(to[index][0], 6);
      expect(y).toBeCloseTo(to[index][1], 6);
    });
  });

  test('점들이 한 줄에 있으면 풀 수 없어 null이어야 한다.', () => {
    expect(
      getPerspectiveTransform(
        [
          [0, 0],
          [1, 1],
          [2, 2],
          [3, 3],
        ],
        DEFAULT_CORNERS,
      ),
    ).toBeNull();
  });
});
