import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RegisterSheet from './RegisterSheet';

const meta = {
  component: RegisterSheet,
  argTypes: {
    isOpen: {
      description: '등록 방법을 고르는 시트를 띄울지 정합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '딤 터치나 아래로 밀어 닫으려 할 때 `false`를 받아 호출합니다.',
    },
    onSelectCamera: {
      description:
        '[사진 촬영]을 누르면 알립니다. 넘기지 않으면 행이 눌리지 않는 모습으로 남습니다.',
    },
    onSelectGallery: {
      description:
        '[갤러리에서 선택]을 누르면 알립니다. 받는 쪽은 사진 고르기 창을 엽니다.',
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    onSelectCamera: fn(),
    onSelectGallery: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '360px' } },
  },
} satisfies Meta<typeof RegisterSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
