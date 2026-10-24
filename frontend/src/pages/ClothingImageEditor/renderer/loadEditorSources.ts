import { convertAlphaToMask } from '@/domains/clothingImageEdit/mask';
import type { Size } from '@/domains/clothingImageEdit/types';

export interface EditorSources {
  size: Size;
  base: ImageBitmap;
  initialMask: HTMLCanvasElement;
  defaultMask: HTMLCanvasElement;
  hasSavedMask: boolean;
  isRestoreAvailable: boolean;
}

interface LoadEditorSourcesParams {
  originUrl: string;
  cutoutUrl: string | null;
  maskUrl: string | null;
}

export class EditorSourcesError extends Error {}

// iOS Safari의 2D 캔버스 면적 한도다.
const MAX_CANVAS_PIXELS = 16_777_216;

const BITMAP_OPTIONS: ImageBitmapOptions = {
  premultiplyAlpha: 'none',
  colorSpaceConversion: 'none',
};

const fetchBlob = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    throw new EditorSourcesError('이미지를 불러오지 못했어요.');
  }

  return response.blob();
};

const createCanvas = (size: Size) => {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  return canvas;
};

const get2dContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (context === null) {
    throw new EditorSourcesError('이미지를 처리하지 못했어요.');
  }

  return context;
};

const createMaskFromAlpha = (cutout: ImageBitmap, size: Size) => {
  const canvas = createCanvas(size);
  const context = get2dContext(canvas);
  context.drawImage(cutout, 0, 0);
  const imageData = context.getImageData(0, 0, size.width, size.height);
  convertAlphaToMask(imageData.data);
  context.putImageData(imageData, 0, 0);

  return canvas;
};

const createMaskFromBlob = async (blob: Blob, size: Size) => {
  const mask = await createImageBitmap(blob, BITMAP_OPTIONS);
  const canvas = createCanvas(size);
  get2dContext(canvas).drawImage(mask, 0, 0, size.width, size.height);
  mask.close();

  return canvas;
};

// 편집 중인 마스크와 [원래대로]에 쓸 기본 마스크가 서로 영향을 주지 않게 복사한다.
export const cloneCanvas = (source: HTMLCanvasElement) => {
  const canvas = createCanvas({ width: source.width, height: source.height });
  get2dContext(canvas).drawImage(source, 0, 0);

  return canvas;
};

const createFilledMask = (size: Size) => {
  const canvas = createCanvas(size);
  const context = get2dContext(canvas);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size.width, size.height);

  return canvas;
};

const decodeResized = async (blob: Blob, size: Size) => {
  try {
    return await createImageBitmap(blob, {
      ...BITMAP_OPTIONS,
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: 'high',
    });
  } catch {
    return null;
  }
};

/*
 * 작업 크기는 누끼(없으면 원본) 크기다. 바탕은 원본을 그 크기로 정확히 줄인 그림이다.
 * 원본은 최대 5천만 화소라, 줄여서 디코딩하지 못하면 누끼를 바탕으로 쓰고 되살리기만 끈다.
 */
export const loadEditorSources = async (
  params: LoadEditorSourcesParams,
): Promise<EditorSources> => {
  const { originUrl, cutoutUrl, maskUrl } = params;
  const [originBlob, cutoutBlob, maskBlob] = await Promise.all([
    fetchBlob(originUrl),
    cutoutUrl === null ? null : fetchBlob(cutoutUrl),
    maskUrl === null ? null : fetchBlob(maskUrl),
  ]);

  // 배경 제거가 끝난 옷은 늘 누끼가 있어, 이 경로는 누끼 없이 편집하는 드문 경우다.
  if (cutoutBlob === null) {
    const origin = await createImageBitmap(originBlob, BITMAP_OPTIONS);
    const size = { width: origin.width, height: origin.height };

    if (size.width * size.height > MAX_CANVAS_PIXELS) {
      origin.close();
      throw new EditorSourcesError('사진이 너무 커서 편집할 수 없어요.');
    }

    const defaultMask = createFilledMask(size);
    const initialMask =
      maskBlob === null
        ? cloneCanvas(defaultMask)
        : await createMaskFromBlob(maskBlob, size);

    return {
      size,
      base: origin,
      initialMask,
      defaultMask,
      hasSavedMask: maskBlob !== null,
      isRestoreAvailable: true,
    };
  }

  const cutout = await createImageBitmap(cutoutBlob, BITMAP_OPTIONS);
  const size = { width: cutout.width, height: cutout.height };
  const defaultMask = createMaskFromAlpha(cutout, size);
  const initialMask =
    maskBlob === null
      ? cloneCanvas(defaultMask)
      : await createMaskFromBlob(maskBlob, size);
  const hasSavedMask = maskBlob !== null;
  const base = await decodeResized(originBlob, size);

  if (base === null) {
    return {
      size,
      base: cutout,
      initialMask,
      defaultMask,
      hasSavedMask,
      isRestoreAvailable: false,
    };
  }

  cutout.close();

  return {
    size,
    base,
    initialMask,
    defaultMask,
    hasSavedMask,
    isRestoreAvailable: true,
  };
};
