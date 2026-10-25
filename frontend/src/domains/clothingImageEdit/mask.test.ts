import { describe, expect, test } from 'vitest';
import { convertAlphaToMask } from './mask';

describe('처음 마스크', () => {
  test('알파를 흑백 값으로 옮기고 불투명하게 만들어야 한다.', () => {
    const pixels = new Uint8ClampedArray([
      10, 20, 30, 255, 40, 50, 60, 0, 1, 2, 3, 128,
    ]);

    expect(Array.from(convertAlphaToMask(pixels))).toEqual([
      255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255,
    ]);
  });
});
