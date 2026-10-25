import { describe, expect, test } from 'vitest';
import { getRotatedBounds } from './rotation';
import { getContainScale, getDiagonalScale } from './displayScale';

describe('미리보기 배율', () => {
  test('영역 안에 다 들어가는 가장 큰 배율이어야 한다.', () => {
    expect(
      getContainScale({ width: 360, height: 420 }, { width: 720, height: 420 }),
    ).toBe(0.5);
  });

  test('대각선 배율이면 어떤 각도로 돌려도 영역을 넘지 않아야 한다.', () => {
    const container = { width: 360, height: 420 };
    const content = { width: 1000, height: 1500 };
    const scale = getDiagonalScale(container, content);

    [0, 17, 45, 84, 90, 133, 180].forEach((angle) => {
      const bounds = getRotatedBounds(content, angle);

      expect(bounds.width * scale).toBeLessThanOrEqual(container.width + 1);
      expect(bounds.height * scale).toBeLessThanOrEqual(container.height + 1);
    });
  });
});
