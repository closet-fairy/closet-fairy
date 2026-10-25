import { useEffect, useRef } from 'react';
import { getOutputGeometry } from '@/domains/clothingImageEdit/outputGeometry';
import type { Quad, Size } from '@/domains/clothingImageEdit/types';
import type {
  EditorRenderer,
  RenderOptions,
} from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import { createEditorRenderer } from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import * as S from './EditorCanvas.styled';

interface EditorCanvasProps {
  base: TexImageSource;
  size: Size;
  mask: TexImageSource;
  maskVersion?: number;
  corners: Quad;
  angle: number;
  faintOpacity?: number;
  displayScale?: number;
  isDrawingBufferPreserved?: boolean;
  onReady?: (renderer: EditorRenderer, canvas: HTMLCanvasElement) => void;
  onError?: (error: unknown) => void;
  'aria-label': string;
}

const EditorCanvas = (props: EditorCanvasProps) => {
  const {
    base,
    size,
    mask,
    maskVersion = 0,
    corners,
    angle,
    faintOpacity = 0,
    displayScale,
    isDrawingBufferPreserved = false,
    onReady,
    onError,
    'aria-label': ariaLabel,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EditorRenderer | null>(null);
  const latestOptionsRef = useRef<RenderOptions>({
    corners,
    angle,
    faintOpacity,
  });
  const latestBaseRef = useRef<{ source: TexImageSource; size: Size } | null>(
    null,
  );
  const latestMaskRef = useRef<TexImageSource | null>(null);
  const callbacksRef = useRef({ onReady, onError });
  const { width, height } = size;

  useEffect(() => {
    callbacksRef.current = { onReady, onError };
  }, [onReady, onError]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null) {
      return;
    }

    let renderer: EditorRenderer;

    try {
      renderer = createEditorRenderer(canvas, {
        preserveDrawingBuffer: isDrawingBufferPreserved,
        onRestored: () => {
          renderer.render(latestOptionsRef.current);
        },
        onError: (error) => {
          callbacksRef.current.onError?.(error);
        },
      });
    } catch (error) {
      callbacksRef.current.onError?.(error);
      return;
    }

    rendererRef.current = renderer;

    // 렌더러를 다시 만들면 텍스처가 비어 있으므로, 들고 있던 원본과 마스크를 바로 올린다.
    const latestBase = latestBaseRef.current;
    const latestMask = latestMaskRef.current;

    if (latestBase !== null && latestMask !== null) {
      renderer.setBase(latestBase.source, latestBase.size);
      renderer.setMask(latestMask);
      renderer.render(latestOptionsRef.current);
    }

    callbacksRef.current.onReady?.(renderer, canvas);

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [isDrawingBufferPreserved]);

  useEffect(() => {
    latestBaseRef.current = { source: base, size: { width, height } };
    rendererRef.current?.setBase(base, { width, height });
  }, [base, width, height]);

  useEffect(() => {
    latestMaskRef.current = mask;
    rendererRef.current?.setMask(mask);
  }, [mask, maskVersion]);

  useEffect(() => {
    const options = { corners, angle, faintOpacity };
    latestOptionsRef.current = options;
    rendererRef.current?.render(options);
  }, [base, width, height, mask, maskVersion, corners, angle, faintOpacity]);

  const outputSize =
    displayScale === undefined
      ? null
      : getOutputGeometry({ width, height }, corners, angle)?.outputSize;

  return (
    <S.Canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      $isScaled={outputSize !== null && outputSize !== undefined}
      style={
        outputSize && displayScale !== undefined
          ? {
              width: outputSize.width * displayScale,
              height: outputSize.height * displayScale,
            }
          : undefined
      }
    />
  );
};

export default EditorCanvas;
