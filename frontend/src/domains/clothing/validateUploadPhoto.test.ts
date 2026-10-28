import { describe, expect, test } from 'vitest';
import {
  UPLOAD_PHOTO_MAX_BYTES,
  validateUploadPhoto,
} from './validateUploadPhoto';

const photo = (name: string, type: string, size = 1024) => ({
  name,
  type,
  size,
});

describe('등록 사진 형식 검증', () => {
  test('JPG, PNG, WEBP, HEIC 사진은 통과해야 한다.', () => {
    expect(validateUploadPhoto(photo('a.jpg', 'image/jpeg'))).toBeNull();
    expect(validateUploadPhoto(photo('a.png', 'image/png'))).toBeNull();
    expect(validateUploadPhoto(photo('a.webp', 'image/webp'))).toBeNull();
    expect(validateUploadPhoto(photo('a.HEIC', 'image/heic'))).toBeNull();
  });

  test('type이 비어 있어도 확장자가 HEIC면 통과해야 한다.', () => {
    expect(validateUploadPhoto(photo('IMG_2077.HEIC', ''))).toBeNull();
    expect(validateUploadPhoto(photo('IMG_2077.heif', ''))).toBeNull();
  });

  test('그 밖의 형식이면 올릴 수 있는 형식을 알려야 한다.', () => {
    expect(validateUploadPhoto(photo('IMG_1983.GIF', 'image/gif'))).toBe(
      'JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요',
    );
    expect(validateUploadPhoto(photo('memo', ''))).toBe(
      'JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요',
    );
  });
});

describe('등록 사진 용량 검증', () => {
  test('20MB까지는 통과해야 한다.', () => {
    expect(
      validateUploadPhoto(photo('a.jpg', 'image/jpeg', UPLOAD_PHOTO_MAX_BYTES)),
    ).toBeNull();
  });

  test('20MB를 넘으면 용량 상한을 알려야 한다.', () => {
    expect(
      validateUploadPhoto(
        photo('a.jpg', 'image/jpeg', UPLOAD_PHOTO_MAX_BYTES + 1),
      ),
    ).toBe('20MB 이하 사진만 올릴 수 있어요');
  });

  test('형식과 용량이 모두 맞지 않으면 형식을 먼저 알려야 한다.', () => {
    expect(
      validateUploadPhoto(
        photo('a.gif', 'image/gif', UPLOAD_PHOTO_MAX_BYTES + 1),
      ),
    ).toBe('JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요');
  });
});
