import { isValidQuad } from '@/domains/clothingImageEdit/perspective';
import type { Size } from '@/domains/clothingImageEdit/types';
import { PerspectiveParam } from '@/generated/models';
import type { ClothingDetail } from '@/generated/models';
import type { InitialEdit } from '@/pages/ClothingImageEditor/imageEditorState';

interface SavedEdit {
  initialEdit: InitialEdit;
  hasInvalidSavedEdit: boolean;
}

/*
 * 생성 스키마가 원근값을 unknown으로 받아 여기서 좁힌다.
 * 저장된 원근값을 쓸 수 없으면 기본값으로 시작하므로, 바뀐 게 없어도 저장해 서버 값을 바로잡게 한다.
 */
export const parseSavedEdit = (
  edit: ClothingDetail['edit'],
  size: Size,
): SavedEdit => {
  if (edit === null) {
    return {
      initialEdit: { rotationAngle: 0, corners: null },
      hasInvalidSavedEdit: false,
    };
  }

  const rotationAngle = edit.rotation_angle;
  const perspectiveParam = edit.perspective_param ?? null;

  if (perspectiveParam === null) {
    return {
      initialEdit: { rotationAngle, corners: null },
      hasInvalidSavedEdit: false,
    };
  }

  const result = PerspectiveParam.safeParse(perspectiveParam);
  const corners =
    result.success && isValidQuad(result.data.corners, size)
      ? result.data.corners
      : null;

  return {
    initialEdit: { rotationAngle, corners },
    hasInvalidSavedEdit: corners === null,
  };
};
