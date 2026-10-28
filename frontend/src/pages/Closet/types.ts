export type ClothingStatusDialogVariant = 'processing' | 'failed';

export interface PickedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  // 형식·용량이 맞지 않아 미리 걸러 낸 사진이면 그 사유다.
  rejectMessage: string | null;
}

export type PhotoTileState = 'selected' | 'discarded' | 'locked';
