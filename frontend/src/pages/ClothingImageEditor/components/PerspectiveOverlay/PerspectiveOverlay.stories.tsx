import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { fn } from 'storybook/test';
import { getContainScale } from '@/domains/clothingImageEdit/displayScale';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import { getQuarterTurnedSize } from '@/domains/clothingImageEdit/rotation';
import type { Quad } from '@/domains/clothingImageEdit/types';
import {
  createStorySamples,
  SAMPLE_SIZE,
} from '@/pages/ClothingImageEditor/storySamples';
import { bg } from '@/styles/tokens';
import PerspectiveOverlay from './PerspectiveOverlay';

const SAMPLES = createStorySamples();

const STAGE_SIZE = { width: 390, height: 560 };
// 편집기 스테이지처럼 [원래대로] 칩 줄(12 + 32 + 8px) 아래에서 그림을 시작한다.
const VIEWPORT_TOP = 52;
const VIEWPORT_INSET = 16;
const VIEWPORT_SIZE = {
  width: STAGE_SIZE.width - VIEWPORT_INSET * 2,
  height: STAGE_SIZE.height - VIEWPORT_TOP - VIEWPORT_INSET,
};

const PULLED_IN_CORNERS: Quad = [
  [0.12, 0.14],
  [0.9, 0.1],
  [0.95, 0.9],
  [0.06, 0.86],
];

const Stage = styled.div`
  position: relative;
  width: ${STAGE_SIZE.width}px;
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

const Box = styled.div`
  position: relative;
  flex: none;
`;

const Picture = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`;

const meta = {
  component: PerspectiveOverlay,
  argTypes: {
    corners: {
      description:
        '원근 꼭짓점(좌상·우상·우하·좌하)입니다. 누끼(원래 방향) 기준 0~1 좌표입니다.',
      control: 'object',
    },
    quarterTurns: {
      description:
        '화면에 보이는 그림의 90° 단위 방향입니다(0~3). 꼭짓점은 이 방향으로 돌려 그리고, 끈 자리는 거꾸로 돌려 알립니다.',
      control: { type: 'number', min: 0, max: 3, step: 1 },
    },
    onChange: {
      description:
        '꼭짓점을 끌어 옮겼을 때 새 꼭짓점(누끼 기준)을 알립니다. 사각형이 꼬이거나 너무 작아지는 자리로는 알리지 않습니다.',
    },
    onDraggingChange: {
      description: '꼭짓점을 잡고 놓을 때 알립니다.',
    },
    magnifierSource: {
      description:
        '돋보기에 확대해 보여 줄 캔버스입니다. 화면 상자와 같은 그림(90° 방향만 돌린 그림)이 그려져 있어야 합니다. WebGL 캔버스라면 preserveDrawingBuffer로 그려야 읽을 수 있습니다.',
      control: false,
    },
    magnifierContainer: {
      description:
        '돋보기를 띄울 요소입니다(편집기 스테이지). 주지 않으면 오버레이 상자 기준으로 띄웁니다.',
      control: false,
    },
    magnifierTop: {
      description:
        '돋보기의 위쪽 위치(px)입니다. 왼쪽에 뜰 때 [원래대로] 칩을 피하도록 칩 아래 값을 줍니다. 기본값은 12px입니다.',
      control: 'number',
    },
    isDisabled: {
      description: '저장 중처럼 꼭짓점을 잡지 못하게 막을 때 씁니다.',
      control: 'boolean',
    },
  },
  args: {
    corners: DEFAULT_CORNERS,
    quarterTurns: 0,
    onChange: fn(),
    onDraggingChange: fn(),
    magnifierSource: null,
    magnifierTop: VIEWPORT_TOP,
    isDisabled: false,
  },
  render: function Render(args) {
    const [corners, setCorners] = useState(args.corners);
    const [stage, setStage] = useState<HTMLDivElement | null>(null);
    const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);
    const pictureSize = getQuarterTurnedSize(SAMPLE_SIZE, args.quarterTurns);
    const scale = getContainScale(VIEWPORT_SIZE, pictureSize);

    useEffect(() => {
      const context = picture?.getContext('2d');

      if (!context) {
        return;
      }

      context.save();
      context.translate(pictureSize.width / 2, pictureSize.height / 2);
      context.rotate((args.quarterTurns * Math.PI) / 2);
      context.drawImage(
        SAMPLES.base,
        -SAMPLE_SIZE.width / 2,
        -SAMPLE_SIZE.height / 2,
      );
      context.restore();
    }, [picture, args.quarterTurns, pictureSize.width, pictureSize.height]);

    const handleChange = (nextCorners: Quad) => {
      args.onChange(nextCorners);
      setCorners(nextCorners);
    };

    return (
      <Stage ref={setStage}>
        <Viewport>
          <Box
            style={{
              width: pictureSize.width * scale,
              height: pictureSize.height * scale,
            }}
          >
            <Picture
              ref={setPicture}
              width={pictureSize.width}
              height={pictureSize.height}
            />
            <PerspectiveOverlay
              {...args}
              corners={corners}
              onChange={handleChange}
              magnifierSource={picture}
              magnifierContainer={stage}
            />
          </Box>
        </Viewport>
      </Stage>
    );
  },
} satisfies Meta<typeof PerspectiveOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PulledIn: Story = {
  args: {
    corners: PULLED_IN_CORNERS,
  },
};

export const QuarterTurned: Story = {
  args: {
    corners: PULLED_IN_CORNERS,
    quarterTurns: 1,
  },
};

export const Disabled: Story = {
  args: {
    corners: PULLED_IN_CORNERS,
    isDisabled: true,
  },
};
