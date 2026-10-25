import { describe, expect, test } from 'vitest';
import { getMagnifierCrop, MAGNIFIER_SIZE, MAGNIFIER_ZOOM } from './magnifier';

const BOX_SIZE = { width: 200, height: 200 };
const SOURCE_SIZE = { width: 400, height: 400 };
const DESTINATION_SIZE = 224;
// 상자 1px이 원본 2px이므로, 돋보기 반지름을 원본 픽셀로 바꾼 값이다.
const SOURCE_RADIUS = (MAGNIFIER_SIZE / 2 / MAGNIFIER_ZOOM) * 2;

describe('돋보기 영역 자르기', () => {
  test('꼭짓점 둘레를 3배로 키워 돋보기 전체에 그려야 한다.', () => {
    const crop = getMagnifierCrop({
      center: [0.5, 0.25],
      boxSize: BOX_SIZE,
      sourceSize: SOURCE_SIZE,
      destinationSize: DESTINATION_SIZE,
    });

    expect(crop?.sx).toBeCloseTo(200 - SOURCE_RADIUS);
    expect(crop?.sy).toBeCloseTo(100 - SOURCE_RADIUS);
    expect(crop?.sw).toBeCloseTo(SOURCE_RADIUS * 2);
    expect(crop?.dx).toBeCloseTo(0);
    expect(crop?.dw).toBeCloseTo(DESTINATION_SIZE);
  });

  test('사진 귀퉁이에서는 사진 안쪽만 잘라 돋보기의 해당 자리에만 그려야 한다.', () => {
    const crop = getMagnifierCrop({
      center: [0, 1],
      boxSize: BOX_SIZE,
      sourceSize: SOURCE_SIZE,
      destinationSize: DESTINATION_SIZE,
    });

    expect(crop?.sx).toBeCloseTo(0);
    expect(crop?.sw).toBeCloseTo(SOURCE_RADIUS);
    expect(crop?.dx).toBeCloseTo(DESTINATION_SIZE / 2);
    expect(crop?.dw).toBeCloseTo(DESTINATION_SIZE / 2);
    expect(crop?.sy).toBeCloseTo(400 - SOURCE_RADIUS);
    expect(crop?.sh).toBeCloseTo(SOURCE_RADIUS);
    expect(crop?.dy).toBeCloseTo(0);
    expect(crop?.dh).toBeCloseTo(DESTINATION_SIZE / 2);
  });

  test('돋보기 범위가 사진과 겹치지 않으면 그리지 않아야 한다.', () => {
    const crop = getMagnifierCrop({
      center: [-1, 0.5],
      boxSize: BOX_SIZE,
      sourceSize: SOURCE_SIZE,
      destinationSize: DESTINATION_SIZE,
    });

    expect(crop).toBeNull();
  });
});
