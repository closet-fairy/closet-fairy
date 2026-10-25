import { describe, expect, test } from 'vitest';
import { parseSavedEdit } from './parseSavedEdit';

const SIZE = { width: 300, height: 400 };

const VALID_CORNERS = [
  [0.02, 0.01],
  [0.98, 0.02],
  [0.99, 0.99],
  [0.01, 0.98],
];

const createEdit = (perspectiveParam: unknown) => ({
  rotation_angle: 8,
  perspective_param: perspectiveParam,
  brush_mask_url: null,
  display_image_url: null,
});

describe('저장된 편집값 읽기', () => {
  test('편집한 적이 없으면 0°, 원근 없음으로 시작해야 한다.', () => {
    expect(parseSavedEdit(null, SIZE)).toEqual({
      initialEdit: { rotationAngle: 0, corners: null },
      hasInvalidSavedEdit: false,
    });
  });

  test('원근값이 없으면 각도만 읽어야 한다.', () => {
    expect(parseSavedEdit(createEdit(null), SIZE)).toEqual({
      initialEdit: { rotationAngle: 8, corners: null },
      hasInvalidSavedEdit: false,
    });
  });

  test('올바른 원근값은 꼭짓점으로 읽어야 한다.', () => {
    expect(
      parseSavedEdit(createEdit({ corners: VALID_CORNERS }), SIZE),
    ).toEqual({
      initialEdit: { rotationAngle: 8, corners: VALID_CORNERS },
      hasInvalidSavedEdit: false,
    });
  });
});

describe('쓸 수 없는 원근값', () => {
  test('형식이 맞지 않으면 원근 없이 시작하고 다시 저장하게 해야 한다.', () => {
    expect(parseSavedEdit(createEdit({ corners: [[0, 0]] }), SIZE)).toEqual({
      initialEdit: { rotationAngle: 8, corners: null },
      hasInvalidSavedEdit: true,
    });
  });

  test('형식은 맞아도 꼬인 사각형이면 원근 없이 시작하고 다시 저장하게 해야 한다.', () => {
    const twisted = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
    ];

    expect(parseSavedEdit(createEdit({ corners: twisted }), SIZE)).toEqual({
      initialEdit: { rotationAngle: 8, corners: null },
      hasInvalidSavedEdit: true,
    });
  });
});
