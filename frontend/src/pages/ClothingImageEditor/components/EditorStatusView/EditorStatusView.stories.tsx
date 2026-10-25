import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Button from '@/components/common/Button';
import { UNSUPPORTED_MESSAGE } from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import EditorStatusView from './EditorStatusView';

const meta = {
  component: EditorStatusView,
  argTypes: {
    title: {
      description:
        '가운데에 보여 줄 안내 제목입니다. 넘기지 않으면 상단 바만 그립니다(404 안내 다이얼로그 뒤 배경 등).',
      control: 'text',
    },
    description: {
      description: '제목 아래 보조 설명입니다.',
      control: 'text',
    },
    actions: {
      description: '화면 아래쪽 버튼 자리입니다. [다시 시도] 등을 넘깁니다.',
      control: false,
    },
    onClose: {
      description: '상단 바의 닫기를 누르면 알립니다.',
    },
  },
  args: {
    title: '불러오고 있어요',
    onClose: fn(),
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof EditorStatusView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const LoadFailed: Story = {
  args: {
    title: '이미지를 불러오지 못했어요.',
    actions: (
      <Button isFullWidth onClick={fn()}>
        다시 시도
      </Button>
    ),
  },
};

export const Processing: Story = {
  args: {
    title: '사진을 처리하고 있어요',
    description: '처리가 끝나면 편집할 수 있어요.',
  },
};

export const Unsupported: Story = {
  args: {
    title: UNSUPPORTED_MESSAGE,
  },
};

export const Empty: Story = {
  args: {
    title: undefined,
  },
};
