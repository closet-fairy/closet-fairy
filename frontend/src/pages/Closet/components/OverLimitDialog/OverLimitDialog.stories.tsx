import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import OverLimitDialog from './OverLimitDialog';

const meta = {
  component: OverLimitDialog,
  argTypes: {
    isOpen: {
      description:
        '갤러리에서 20장보다 많이 가져왔을 때 사진 확인 화면을 열기 전에 띄웁니다.',
      control: 'boolean',
    },
    onConfirm: {
      description:
        '[확인]을 누르거나 딤 터치·Esc로 닫으면 알립니다. 받는 쪽은 사진 확인 화면을 엽니다.',
    },
  },
  args: {
    isOpen: true,
    onConfirm: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '320px' } },
  },
} satisfies Meta<typeof OverLimitDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
