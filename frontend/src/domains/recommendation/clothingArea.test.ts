import { describe, expect, test } from 'vitest';
import { getClothingArea } from './clothingArea';

const SIZE = 100;

const createImage = (
  rects: readonly [number, number, number, number, number?][],
  width = SIZE,
  height = SIZE,
) => {
  const data = new Uint8ClampedArray(width * height * 4);

  rects.forEach(([left, top, rectWidth, rectHeight, alpha = 255]) => {
    for (let y = top; y < top + rectHeight; y += 1) {
      for (let x = left; x < left + rectWidth; x += 1) {
        data[(y * width + x) * 4 + 3] = alpha;
      }
    }
  });

  return { data, width, height };
};

describe('옷 영역', () => {
  test('투명 여백을 뺀 영역을 사진 대비 비율로 구해야 한다.', () => {
    expect(getClothingArea(createImage([[10, 20, 30, 60]]), 1)).toEqual({
      left: 0.1,
      top: 0.2,
      width: 0.3,
      height: 0.6,
      ratio: 0.5,
    });
  });

  test('줄여 읽은 사진의 비율이 아니라 원본 비율로 옷 비율을 구해야 한다.', () => {
    const area = getClothingArea(createImage([[0, 0, 50, 50]]), 2);

    expect(area?.ratio).toBe(2);
  });

  test('사진 전체가 불투명하면 전체를 영역으로 봐야 한다.', () => {
    expect(getClothingArea(createImage([[0, 0, 100, 100]]), 1)).toEqual({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      ratio: 1,
    });
  });

  test('거의 투명한 픽셀은 옷으로 보지 않아야 한다.', () => {
    const image = createImage([
      [0, 0, 100, 100, 23],
      [40, 40, 20, 20, 24],
    ]);

    expect(getClothingArea(image, 1)).toMatchObject({
      left: 0.4,
      top: 0.4,
      width: 0.2,
      height: 0.2,
    });
  });

  test('옷이 없는 사진은 영역이 없어야 한다.', () => {
    expect(getClothingArea(createImage([]), 1)).toBeNull();
  });
});

describe('작은 점 거르기', () => {
  test('가장 큰 덩어리의 1% 미만인 점은 영역에 넣지 않아야 한다.', () => {
    const image = createImage([
      [10, 10, 50, 50],
      [90, 90, 4, 6],
    ]);

    expect(getClothingArea(image, 1)).toMatchObject({
      width: 0.5,
      height: 0.5,
    });
  });

  test('가장 큰 덩어리의 1% 이상인 덩어리는 영역에 넣어야 한다.', () => {
    const image = createImage([
      [10, 10, 50, 50],
      [90, 90, 5, 5],
    ]);

    expect(getClothingArea(image, 1)).toMatchObject({
      left: 0.1,
      top: 0.1,
      width: 0.85,
      height: 0.85,
    });
  });

  test('신발 한 켤레처럼 떨어진 두 덩어리는 함께 영역이 되어야 한다.', () => {
    const image = createImage([
      [10, 40, 30, 20],
      [60, 40, 30, 20],
    ]);

    expect(getClothingArea(image, 1)).toMatchObject({
      left: 0.1,
      width: 0.8,
    });
  });

  test('대각선으로 닿은 픽셀은 한 덩어리로 봐야 한다.', () => {
    const image = createImage([
      [0, 0, 50, 50],
      [50, 50, 1, 1],
      [51, 51, 1, 1],
    ]);

    expect(getClothingArea(image, 1)).toMatchObject({
      width: 0.52,
      height: 0.52,
    });
  });

  test('오른쪽 끝과 왼쪽 끝의 픽셀을 다음 줄로 넘겨 잇지 않아야 한다.', () => {
    const image = createImage([
      [50, 40, 50, 20],
      [0, 40, 1, 1],
      [0, 60, 1, 1],
    ]);

    expect(getClothingArea(image, 1)).toMatchObject({
      left: 0.5,
      width: 0.5,
    });
  });
});
