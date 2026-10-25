import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { BRUSH_SIZE_DEFAULT } from '@/domains/clothingImageEdit/brush';
import type { BrushMode } from '@/domains/clothingImageEdit/brush';
import { spacing } from '@/styles/tokens';
import BrushPanel from './BrushPanel';

const Frame = styled.div`
  width: 390px;
  padding: ${spacing[16]} ${spacing[20]} ${spacing[20]};
`;

const meta = {
  component: BrushPanel,
  argTypes: {
    mode: {
      description:
        '붓 모드입니다. 지우기(erase)는 마스크를 검게, 되살리기(restore)는 희게 칠합니다.',
      control: 'inline-radio',
      options: ['erase', 'restore'],
    },
    onModeChange: { description: '모드 전환 버튼을 눌렀을 때 알립니다.' },
    brushSize: {
      description: '붓 크기입니다. 화면 px 지름이며 4~80입니다.',
      control: { type: 'range', min: 4, max: 80, step: 1 },
    },
    onBrushSizeChange: {
      description: '붓 크기 슬라이더를 움직였을 때 알립니다.',
    },
    onBrushSizeDraggingChange: {
      description:
        '붓 크기 슬라이더를 잡고 놓을 때 알립니다. 편집기는 잡는 동안 스테이지 가운데에 붓 크기 원을 띄웁니다.',
    },
    isUndoAvailable: {
      description: '실행 취소할 획이 있는지입니다. 없으면 버튼이 비활성입니다.',
      control: 'boolean',
    },
    isRedoAvailable: {
      description: '다시 실행할 획이 있는지입니다. 없으면 버튼이 비활성입니다.',
      control: 'boolean',
    },
    onUndo: { description: '[실행 취소]를 눌렀을 때 알립니다.' },
    onRedo: { description: '[다시 실행]을 눌렀을 때 알립니다.' },
    isRestoreAvailable: {
      description:
        '되살리기를 쓸 수 있는지입니다. 원본을 줄이지 못해 바탕이 누끼면 되살려도 보일 게 없어, 모드 전환을 막고 안내를 띄웁니다.',
      control: 'boolean',
    },
    isDisabled: {
      description: '저장 중처럼 모든 조작을 막을 때 씁니다.',
      control: 'boolean',
    },
  },
  args: {
    mode: 'erase',
    onModeChange: fn(),
    brushSize: BRUSH_SIZE_DEFAULT,
    onBrushSizeChange: fn(),
    onBrushSizeDraggingChange: fn(),
    isUndoAvailable: false,
    isRedoAvailable: false,
    onUndo: fn(),
    onRedo: fn(),
    isRestoreAvailable: true,
    isDisabled: false,
  },
  render: function Render(args) {
    const [mode, setMode] = useState<BrushMode>(args.mode);
    const [brushSize, setBrushSize] = useState(args.brushSize);

    return (
      <Frame>
        <BrushPanel
          {...args}
          mode={mode}
          onModeChange={(nextMode) => {
            args.onModeChange(nextMode);
            setMode(nextMode);
          }}
          brushSize={brushSize}
          onBrushSizeChange={(size) => {
            args.onBrushSizeChange(size);
            setBrushSize(size);
          }}
        />
      </Frame>
    );
  },
} satisfies Meta<typeof BrushPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Restore: Story = {
  args: { mode: 'restore' },
};

export const WithHistory: Story = {
  args: { isUndoAvailable: true, isRedoAvailable: true, brushSize: 36 },
};

export const RestoreUnavailable: Story = {
  args: { isRestoreAvailable: false, isUndoAvailable: true },
};

export const Disabled: Story = {
  args: { isDisabled: true, isUndoAvailable: true },
};
