import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  createStorySamples,
  SAMPLE_SIZE,
} from '@/pages/ClothingImageEditor/storySamples';
import ImageEditor from './ImageEditor';

const SAMPLES = createStorySamples();

const meta = {
  component: ImageEditor,
  argTypes: {
    sources: {
      description:
        '`loadEditorSources`로 불러온 바탕 그림, 작업 크기, 처음 마스크, 기본 마스크입니다. 스토리는 캔버스로 그린 합성 샘플을 쓰고, 처음 마스크는 소매 한 군데를 지운 상태입니다.',
      control: false,
    },
    initialEdit: {
      description:
        '저장되어 있던 편집값입니다. 회전 각도와 원근 꼭짓점(없으면 null)을 받습니다.',
      control: 'object',
    },
    isSaving: {
      description:
        '저장 중인지 나타냅니다. 저장 버튼 자리에 로딩을 띄우고 닫기·단계·원래대로·도구를 모두 막습니다.',
      control: 'boolean',
    },
    onSave: {
      description:
        '[저장]을 누르면 편집 상태와 편집한 마스크 캔버스를 넘깁니다.',
    },
    onClose: {
      description:
        '편집기를 닫을 때 알립니다. 바뀐 게 있으면 확인 다이얼로그에서 [버리기]를 누른 뒤에 알립니다.',
    },
  },
  args: {
    sources: {
      size: SAMPLE_SIZE,
      base: SAMPLES.base,
      initialMask: SAMPLES.editedMask,
      defaultMask: SAMPLES.defaultMask,
      hasSavedMask: true,
      isRestoreAvailable: true,
    },
    initialEdit: { rotationAngle: 0, corners: null },
    isSaving: false,
    onSave: fn(),
    onClose: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '720px' } },
  },
} satisfies Meta<typeof ImageEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Brush: Story = {};

export const Perspective: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /원근/ }));
  },
};

export const Rotation: Story = {
  args: {
    initialEdit: { rotationAngle: 84, corners: null },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /회전/ }));
  },
};

export const Saving: Story = {
  args: {
    initialEdit: { rotationAngle: 84, corners: null },
    isSaving: true,
  },
};
