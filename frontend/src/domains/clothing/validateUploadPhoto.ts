// BE가 한 번의 등록 요청에서 받는 사진 장수와 한 장의 용량 상한이다.
export const UPLOAD_PHOTO_LIMIT = 20;
export const UPLOAD_PHOTO_MAX_BYTES = 20 * 1024 * 1024;

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

interface UploadPhotoFile {
  name: string;
  type: string;
  size: number;
}

const getExtension = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.');

  return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1).toLowerCase();
};

/*
 * 서버로 보내기 전에 형식과 용량만 미리 거른다. 기기에 따라 HEIC 사진의 type이 비어 오므로
 * type과 확장자 중 하나라도 맞으면 통과시키고, 내용이 실제로 맞는지는 서버가 다시 본다.
 */
export const validateUploadPhoto = (file: UploadPhotoFile) => {
  const isAcceptedFormat =
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.includes(getExtension(file.name));

  if (!isAcceptedFormat) {
    return 'JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요';
  }

  if (file.size > UPLOAD_PHOTO_MAX_BYTES) {
    return `${UPLOAD_PHOTO_MAX_BYTES / 1024 / 1024}MB 이하 사진만 올릴 수 있어요`;
  }

  return null;
};
