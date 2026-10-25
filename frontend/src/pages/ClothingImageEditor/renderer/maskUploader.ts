import { unionRects } from '@/domains/clothingImageEdit/brush';
import type { Rect } from '@/domains/clothingImageEdit/brush';
import type {
  EditorRenderer,
  RenderOptions,
} from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';

export interface MaskUploader {
  markDirty: (rect: Rect | null) => void;
  markAllDirty: () => void;
  dispose: () => void;
}

interface CreateMaskUploaderParams {
  renderer: Pick<EditorRenderer, 'setMask' | 'updateMaskRegion' | 'render'>;
  mask: HTMLCanvasElement;
  getRenderOptions: () => RenderOptions;
  readRegion?: (mask: HTMLCanvasElement, rect: Rect) => ImageData | null;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
}

const readMaskRegion = (mask: HTMLCanvasElement, rect: Rect) =>
  mask
    .getContext('2d', { willReadFrequently: true })
    ?.getImageData(rect.x, rect.y, rect.width, rect.height) ?? null;

/*
 * 붓질한 영역만 모아 한 프레임에 한 번 GPU로 올린다.
 * 매번 마스크 전체를 올리면 1200만 화소에서 한 번에 48MB를 옮기게 된다.
 */
export const createMaskUploader = (
  params: CreateMaskUploaderParams,
): MaskUploader => {
  const {
    renderer,
    mask,
    getRenderOptions,
    readRegion = readMaskRegion,
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (handle) => cancelAnimationFrame(handle),
  } = params;

  let dirtyRect: Rect | null = null;
  let isAllDirty = false;
  let frame: number | null = null;

  const flush = () => {
    if (frame !== null) {
      cancelFrame(frame);
      frame = null;
    }

    if (isAllDirty) {
      renderer.setMask(mask);
    } else if (dirtyRect !== null) {
      const imageData = readRegion(mask, dirtyRect);

      if (imageData === null) {
        renderer.setMask(mask);
      } else {
        renderer.updateMaskRegion({
          x: dirtyRect.x,
          y: dirtyRect.y,
          imageData,
        });
      }
    } else {
      return;
    }

    isAllDirty = false;
    dirtyRect = null;
    renderer.render(getRenderOptions());
  };

  const schedule = () => {
    if (frame === null) {
      frame = requestFrame(flush);
    }
  };

  return {
    markDirty: (rect) => {
      if (rect === null) {
        return;
      }

      dirtyRect = unionRects(dirtyRect, rect);
      schedule();
    },
    markAllDirty: () => {
      isAllDirty = true;
      schedule();
    },
    dispose: () => {
      if (frame !== null) {
        cancelFrame(frame);
        frame = null;
      }

      dirtyRect = null;
      isAllDirty = false;
    },
  };
};
