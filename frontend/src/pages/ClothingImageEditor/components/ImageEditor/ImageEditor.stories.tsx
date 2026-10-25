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
    saveErrorMessage: {
      description:
        '저장 실패 문구입니다. 넘기면 단계 띠 아래에 [다시 시도]와 함께 보여 줍니다. [다시 시도]는 [저장]과 같은 일을 합니다.',
      control: 'text',
    },
    onSave: {
      description:
        '[저장]이나 [다시 시도]를 누르면 편집 상태, 편집한 마스크 캔버스, 바뀐 게 있는지를 넘깁니다. `saved`로 끝나면 편집기를 닫고(`onClose`), `failed`면 머뭅니다.',
    },
    onClose: {
      description:
        '편집기를 닫을 때 알립니다. 바뀐 게 있으면 확인 다이얼로그에서 [버리기]를 누른 뒤에 알립니다. 저장에 성공했을 때도 알립니다.',
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
    saveErrorMessage: null,
    onSave: fn(() => Promise.resolve('failed' as const)),
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

export const SaveFailed: Story = {
  args: {
    initialEdit: { rotationAngle: 84, corners: null },
    saveErrorMessage: '처리가 끝난 옷만 수정할 수 있습니다.',
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /회전/ }));
  },
};

export const RetryingSave: Story = {
  args: {
    initialEdit: { rotationAngle: 84, corners: null },
    isSaving: true,
    saveErrorMessage: '이미지를 저장하지 못했어요.',
  },
};
