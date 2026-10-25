import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StyleSelectView from './StyleSelectView';

const meta = {
  component: StyleSelectView,
  argTypes: {
    initialValue: {
      description:
        '열 때 미리 골라 둘 스타일입니다. 이 화면 안에서 고친 값은 [완료]를 눌러야 반영됩니다.',
      control: 'object',
    },
    onBack: {
      description:
        '←를 누르면 호출됩니다. 고친 값은 버리고 프로필 수정으로 돌아갑니다.',
    },
    onDone: {
      description: '[완료]를 누르면 고른 스타일 배열로 호출됩니다.',
    },
  },
  args: {
    initialValue: ['minimal', 'casual', 'classic'],
    onBack: fn(),
    onDone: fn(),
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof StyleSelectView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSelection: Story = {
  args: {
    initialValue: [],
  },
};
