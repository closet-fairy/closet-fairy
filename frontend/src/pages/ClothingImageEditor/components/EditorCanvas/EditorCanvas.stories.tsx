import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import { bg } from '@/styles/tokens';
import type { Quad } from '@/domains/clothingImageEdit/types';
import EditorCanvas from './EditorCanvas';

const SIZE = { width: 480, height: 640 };

const drawGarment = (context: CanvasRenderingContext2D) => {
  context.beginPath();
  context.moveTo(150, 120);
  context.lineTo(330, 120);
  context.lineTo(440, 260);
  context.lineTo(390, 300);
  context.lineTo(340, 250);
  context.lineTo(340, 560);
  context.lineTo(140, 560);
  context.lineTo(140, 250);
  context.lineTo(90, 300);
  context.lineTo(40, 260);
  context.closePath();
};

const createCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width;
  canvas.height = SIZE.height;

  return canvas;
};

// 레포에 사진 자산을 두지 않으려고, 배경이 있는 원본과 마스크를 직접 그린다.
const createSamples = () => {
  const base = createCanvas();
  const baseContext = base.getContext('2d');
  const mask = createCanvas();
  const maskContext = mask.getContext('2d');

  if (baseContext === null || maskContext === null) {
    return { base, mask };
  }

  const background = baseContext.createLinearGradient(
    0,
    0,
    SIZE.width,
    SIZE.height,
  );
  background.addColorStop(0, '#d9c7a8');
  background.addColorStop(1, '#8c7a5e');
  baseContext.fillStyle = background;
  baseContext.fillRect(0, 0, SIZE.width, SIZE.height);
  baseContext.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  for (let y = 0; y < SIZE.height; y += 24) {
    baseContext.beginPath();
    baseContext.moveTo(0, y);
    baseContext.lineTo(SIZE.width, y);
    baseContext.stroke();
  }
  drawGarment(baseContext);
  baseContext.fillStyle = '#3b5b8c';
  baseContext.fill();
  baseContext.fillStyle = '#f2f2f2';
  baseContext.fillRect(150, 300, 180, 18);

  maskContext.fillStyle = '#000';
  maskContext.fillRect(0, 0, SIZE.width, SIZE.height);
  drawGarment(maskContext);
  maskContext.fillStyle = '#fff';
  maskContext.fill();
  maskContext.fillStyle = '#000';
  maskContext.beginPath();
  maskContext.arc(380, 280, 34, 0, Math.PI * 2);
  maskContext.fill();

  return { base, mask };
};

const SAMPLES = createSamples();

const TILTED_CORNERS: Quad = [
  [0.12, 0.1],
  [0.92, 0.04],
  [0.98, 0.95],
  [0.04, 0.9],
];

const Frame = styled.div`
  width: 360px;
  height: 420px;
  background-color: ${bg.neutral.soft};
`;

const CROPPED_CORNERS: Quad = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.75, 0.75],
  [0.25, 0.75],
];

const meta = {
  component: EditorCanvas,
  argTypes: {
    base: {
      description:
        '바탕 그림입니다. 원본을 작업 크기(누끼 크기)로 줄인 그림이고, 줄이지 못하면 누끼를 씁니다.',
      control: false,
    },
    size: { description: '작업 크기(누끼 가로×세로)입니다.', control: false },
    mask: {
      description:
        '작업 크기의 흑백 마스크입니다. 흰색은 보이고 검은색은 투명합니다.',
      control: false,
    },
    maskVersion: {
      description:
        '같은 마스크 캔버스에 붓질을 했을 때 다시 올리도록 바꿔 주는 숫자입니다.',
      control: 'number',
    },
    corners: {
      description:
        '원근 꼭짓점(좌상·우상·우하·좌하, 0~1)입니다. 기본값이면 원근을 쓰지 않습니다.',
      control: 'object',
    },
    angle: {
      description:
        '전체 회전 각도입니다. 원근 뒤에 적용하고, 양수는 시계 방향입니다.',
      control: { type: 'range', min: -180, max: 180, step: 1 },
    },
    faintOpacity: {
      description:
        '지워진 영역을 원본으로 흐리게 보여 줄 불투명도입니다. 브러시 단계에서 0.3, 결과 화면에서는 0입니다.',
      control: { type: 'range', min: 0, max: 1, step: 0.05 },
    },
    'aria-label': {
      description: '스크린리더가 읽을 이름입니다.',
      control: 'text',
    },
  },
  args: {
    base: SAMPLES.base,
    size: SIZE,
    mask: SAMPLES.mask,
    corners: DEFAULT_CORNERS,
    angle: 0,
    faintOpacity: 0,
    'aria-label': '편집 미리보기',
  },
  render: function Render(args) {
    return (
      <Frame>
        <EditorCanvas {...args} />
      </Frame>
    );
  },
} satisfies Meta<typeof EditorCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Result: Story = {};

export const BrushView: Story = {
  args: {
    faintOpacity: 0.3,
  },
};

export const Rotated: Story = {
  args: {
    angle: 84,
  },
};

export const Perspective: Story = {
  args: {
    corners: TILTED_CORNERS,
  },
};

export const PerspectiveThenRotation: Story = {
  args: {
    corners: TILTED_CORNERS,
    angle: -6,
  },
};

export const CroppedThenRotated: Story = {
  args: {
    corners: CROPPED_CORNERS,
    angle: 30,
  },
};

export const FixedScale: Story = {
  args: {
    angle: 30,
    displayScale: 0.45,
  },
};
