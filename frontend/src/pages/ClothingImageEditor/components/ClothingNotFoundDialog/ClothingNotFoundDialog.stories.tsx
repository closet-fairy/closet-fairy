import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClothingNotFoundDialog from './ClothingNotFoundDialog';

const meta = {
  component: ClothingNotFoundDialog,
  argTypes: {
    isOpen: {
      description: '안내를 띄울지 정합니다.',
      control: 'boolean',
    },
    onConfirm: {
      description:
        '[확인]을 누르거나 딤 터치·Esc로 닫으면 알립니다. 받는 쪽은 편집기를 닫습니다.',
    },
  },
  args: {
    isOpen: true,
    onConfirm: fn(),
  },
} satisfies Meta<typeof ClothingNotFoundDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
