import { useEffect, useRef } from 'react';
import { getPerspectiveOutputSize } from '@/domains/clothingImageEdit/perspective';
import { getRotatedBounds } from '@/domains/clothingImageEdit/rotation';
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

  const displaySize =
    displayScale === undefined
      ? null
      : getRotatedBounds(
          getPerspectiveOutputSize(corners, { width, height }),
          angle,
        );

  return (
    <S.Canvas
      // 이미 컨텍스트가 있는 캔버스는 속성을 바꿔 다시 받을 수 없어, 드로잉 버퍼 보존이 바뀌면 캔버스를 새로 만든다.
      key={String(isDrawingBufferPreserved)}
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      $isScaled={displaySize !== null}
      style={
        displaySize !== null && displayScale !== undefined
          ? {
              width: displaySize.width * displayScale,
              height: displaySize.height * displayScale,
            }
          : undefined
      }
    />
  );
};

export default EditorCanvas;
