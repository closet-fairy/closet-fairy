import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import { fn } from 'storybook/test';
import { BRUSH_SIZE_DEFAULT } from '@/domains/clothingImageEdit/brush';
import type { BrushMode } from '@/domains/clothingImageEdit/brush';
import { getContainScale } from '@/domains/clothingImageEdit/displayScale';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import { getQuarterTurnedSize } from '@/domains/clothingImageEdit/rotation';
import type { Size } from '@/domains/clothingImageEdit/types';
import BrushPanel from '@/pages/ClothingImageEditor/components/BrushPanel';
import useBrushStrokes from '@/pages/ClothingImageEditor/hooks/useBrushStrokes';
import type {
  EditorRenderer,
  RenderOptions,
} from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import { cloneCanvas } from '@/pages/ClothingImageEditor/renderer/loadEditorSources';
import {
  createStorySamples,
  SAMPLE_SIZE,
} from '@/pages/ClothingImageEditor/storySamples';
import { bg, border, spacing } from '@/styles/tokens';
import BrushSurface from './BrushSurface';
import { DEFAULT_BRUSH_VIEW } from './brushView';
import type { BrushView } from './brushView';

const SAMPLES = createStorySamples();

const STAGE_SIZE = { width: 390, height: 560 };
// 편집기 스테이지처럼 [원래대로] 칩 줄(12 + 32 + 8px) 아래에서 그림을 시작한다.
const VIEWPORT_TOP = 52;
const VIEWPORT_INSET = 16;
const VIEWPORT_SIZE = {
  width: STAGE_SIZE.width - VIEWPORT_INSET * 2,
  height: STAGE_SIZE.height - VIEWPORT_TOP - VIEWPORT_INSET,
};
const FAINT_OPACITY = 0.3;

const Frame = styled.div`
  width: ${STAGE_SIZE.width}px;
  border: 1px solid ${border.neutral.soft};
`;

const Stage = styled.div`
  position: relative;
  height: ${STAGE_SIZE.height}px;
  overflow: hidden;
  background-color: ${bg.neutral.soft};
`;

const Viewport = styled.div`
  position: absolute;
  inset: ${VIEWPORT_INSET}px;
  top: ${VIEWPORT_TOP}px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Picture = styled.canvas`
  display: block;
  flex: none;
`;

const Panel = styled.div`
  padding: ${spacing[16]} ${spacing[20]} ${spacing[20]};
  border-top: 1px solid ${border.neutral.soft};
  background-color: ${bg.white};
`;

// 흑백 마스크의 밝기를 알파로 옮긴다. 미리보기 대역에서 마스크로 그림을 오려 내는 데 쓴다.
const toAlphaMask = (mask: HTMLCanvasElement, target: HTMLCanvasElement) => {
  target.width = mask.width;
  target.height = mask.height;
  const context = target.getContext('2d', { willReadFrequently: true });

  if (context === null) {
    return;
  }

  context.drawImage(mask, 0, 0);
  const imageData = context.getImageData(0, 0, mask.width, mask.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    data[index + 3] = data[index];
  }

  context.putImageData(imageData, 0, 0);
};

/*
 * 스토리에서는 WebGL 대신 2D 캔버스로 같은 그림(흐린 원본 위에 마스크로 오린 원본)을 그린다.
 * 붓질 흐름(칠한 영역 반영, 한 프레임에 한 번 다시 그리기)은 실제 렌더러와 같은 자리로 들어온다.
 */
const create2dRenderer = (canvas: HTMLCanvasElement): EditorRenderer => {
  let base: TexImageSource | null = null;
  let size: Size | null = null;
  let mask: HTMLCanvasElement | null = null;
  const alphaMask = document.createElement('canvas');
  const cutout = document.createElement('canvas');

  return {
    setBase: (source, sourceSize) => {
      base = source;
      size = sourceSize;
    },
    setMask: (source) => {
      mask = source instanceof HTMLCanvasElement ? source : null;
    },
    updateMaskRegion: () => {},
    render: (options: RenderOptions) => {
      const context = canvas.getContext('2d');
      const cutoutContext = cutout.getContext('2d');

      if (
        base === null ||
        size === null ||
        mask === null ||
        !(base instanceof HTMLCanvasElement) ||
        context === null ||
        cutoutContext === null
      ) {
        return null;
      }

      const quarterTurns = Math.round(options.angle / 90);
      const outputSize = getQuarterTurnedSize(size, quarterTurns);
      canvas.width = outputSize.width;
      canvas.height = outputSize.height;

      toAlphaMask(mask, alphaMask);
      cutout.width = size.width;
      cutout.height = size.height;
      cutoutContext.drawImage(base, 0, 0);
      cutoutContext.globalCompositeOperation = 'destination-in';
      cutoutContext.drawImage(alphaMask, 0, 0);

      context.save();
      context.translate(outputSize.width / 2, outputSize.height / 2);
      context.rotate((quarterTurns * Math.PI) / 2);
      context.translate(-size.width / 2, -size.height / 2);
      context.globalAlpha = options.faintOpacity;
      context.drawImage(base, 0, 0);
      context.globalAlpha = 1;
      context.drawImage(cutout, 0, 0);
      context.restore();

      return outputSize;
    },
    dispose: () => {},
    release: () => {},
  };
};

const getCenteredView = (zoom: number, quarterTurns: number): BrushView => {
  const pictureSize = getQuarterTurnedSize(SAMPLE_SIZE, quarterTurns);
  const scale = getContainScale(VIEWPORT_SIZE, pictureSize);
  const centerX = VIEWPORT_INSET + VIEWPORT_SIZE.width / 2;
  const centerY = VIEWPORT_TOP + VIEWPORT_SIZE.height / 2;
  const height = pictureSize.height * scale;

  return {
    zoom,
    x: centerX * (1 - zoom),
    // 그림 위쪽이 보이게 조금 내려 둔다.
    y: centerY * (1 - zoom) + (height * (zoom - 1)) / 4,
  };
};

const meta = {
  component: BrushSurface,
  parameters: { layout: 'centered' },
  argTypes: {
    children: {
      description:
        '확대·이동을 함께 받을 그림 층입니다. 편집기에서는 미리보기 캔버스를 담은 영역을 넘깁니다.',
      control: false,
    },
    targetRef: {
      description:
        '그림이 그려지는 요소(미리보기 캔버스)입니다. 이 요소의 화면 위치로 포인터를 마스크 좌표로 바꿉니다.',
      control: false,
    },
    maskSize: {
      description: '마스크(누끼, 원래 방향) 크기입니다.',
      control: false,
    },
    quarterTurns: {
      description:
        '화면에 보이는 그림의 90° 단위 방향입니다(0~3). 포인터 좌표를 원래 방향으로 돌려 알립니다.',
      control: { type: 'number', min: 0, max: 3, step: 1 },
    },
    brushSize: {
      description:
        '붓 크기입니다. 화면 px 지름이며, 마스크 반지름은 표시 배율과 확대율로 나눠 셉니다.',
      control: { type: 'range', min: 4, max: 80, step: 1 },
    },
    view: {
      description:
        '확대·이동 상태입니다(zoom 1~8, x·y는 표면 px 이동). 바깥에서 들고, 단계를 옮기면 1배로 되돌립니다.',
      control: false,
    },
    onViewChange: {
      description:
        '두 손가락, 휠, Ctrl + 휠, 확대율 칩으로 확대·이동을 바꿀 때 알립니다.',
    },
    isActive: {
      description:
        '브러시 단계인지입니다. 아니면 입력·커서·칩 없이 그림 층만 둡니다. 단계를 옮겨도 캔버스를 다시 만들지 않으려고 늘 감싼 채로 둡니다.',
      control: 'boolean',
    },
    isDisabled: {
      description: '저장 중처럼 그리기와 확대·이동을 막을 때 씁니다.',
      control: 'boolean',
    },
    isSizePreviewVisible: {
      description:
        '붓 크기 슬라이더를 잡는 동안 켭니다. 스테이지 가운데에 붓 크기 원을 띄웁니다.',
      control: 'boolean',
    },
    onStrokeStart: {
      description:
        '획을 시작할 때 첫 점과 반지름(둘 다 마스크 px)을 알립니다. 손가락은 약 100ms 보류한 뒤에 알립니다.',
    },
    onStrokePoints: {
      description: '획이 이어질 때 새 점들(마스크 px)을 알립니다.',
    },
    onStrokeEnd: {
      description:
        '손을 떼거나 두 번째 손가락이 와서 획이 끝날 때 알립니다. 보류 중에 버린 획은 알리지 않습니다.',
    },
  },
  args: {
    children: null,
    targetRef: createRef<HTMLElement>(),
    maskSize: SAMPLE_SIZE,
    quarterTurns: 0,
    brushSize: BRUSH_SIZE_DEFAULT,
    view: DEFAULT_BRUSH_VIEW,
    onViewChange: fn(),
    isActive: true,
    isDisabled: false,
    isSizePreviewVisible: false,
    onStrokeStart: fn(),
    onStrokePoints: fn(),
    onStrokeEnd: fn(),
  },
  render: function Render(args) {
    const { quarterTurns } = args;
    const [mask] = useState(() => cloneCanvas(SAMPLES.editedMask));
    const [view, setView] = useState(args.view);
    const [mode, setMode] = useState<BrushMode>('erase');
    const [brushSize, setBrushSize] = useState(args.brushSize);
    const [isSizeDragging, setIsSizeDragging] = useState(false);
    const pictureRef = useRef<HTMLCanvasElement>(null);
    const pictureSize = getQuarterTurnedSize(SAMPLE_SIZE, quarterTurns);
    const scale = getContainScale(VIEWPORT_SIZE, pictureSize);
    const renderOptions = useMemo(
      () => ({
        corners: DEFAULT_CORNERS,
        angle: quarterTurns * 90,
        faintOpacity: FAINT_OPACITY,
      }),
      [quarterTurns],
    );
    const brush = useBrushStrokes({
      mask,
      baseMask: SAMPLES.editedMask,
      mode,
      renderOptions,
    });
    const { attachRenderer } = brush;

    useEffect(() => {
      const picture = pictureRef.current;

      if (picture === null) {
        return;
      }

      const renderer = create2dRenderer(picture);
      renderer.setBase(SAMPLES.base, SAMPLE_SIZE);
      renderer.setMask(mask);
      renderer.render(renderOptions);
      attachRenderer(renderer);

      return () => {
        attachRenderer(null);
      };
    }, [attachRenderer, mask, renderOptions]);

    return (
      <Frame>
        <Stage>
          <BrushSurface
            {...args}
            targetRef={pictureRef}
            brushSize={brushSize}
            view={view}
            onViewChange={(nextView) => {
              args.onViewChange(nextView);
              setView(nextView);
            }}
            isSizePreviewVisible={args.isSizePreviewVisible || isSizeDragging}
            onStrokeStart={(start) => {
              args.onStrokeStart?.(start);
              brush.handleStrokeStart(start);
            }}
            onStrokePoints={(points) => {
              args.onStrokePoints?.(points);
              brush.handleStrokePoints(points);
            }}
            onStrokeEnd={() => {
              args.onStrokeEnd?.();
              brush.handleStrokeEnd();
            }}
          >
            <Viewport>
              <Picture
                ref={pictureRef}
                aria-label="편집 미리보기"
                role="img"
                style={{
                  width: pictureSize.width * scale,
                  height: pictureSize.height * scale,
                }}
              />
            </Viewport>
          </BrushSurface>
        </Stage>
        <Panel>
          <BrushPanel
            mode={mode}
            onModeChange={setMode}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            onBrushSizeDraggingChange={setIsSizeDragging}
            isUndoAvailable={brush.isUndoAvailable}
            isRedoAvailable={brush.isRedoAvailable}
            onUndo={brush.undo}
            onRedo={brush.redo}
            isDisabled={args.isDisabled}
          />
        </Panel>
      </Frame>
    );
  },
} satisfies Meta<typeof BrushSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Zoomed: Story = {
  args: { view: getCenteredView(2.5, 0) },
};

export const QuarterTurned: Story = {
  args: { quarterTurns: 1 },
};

export const SizePreview: Story = {
  args: { brushSize: 40, isSizePreviewVisible: true },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
