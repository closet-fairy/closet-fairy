import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import EmptyClosetBand from './EmptyClosetBand';

const LIST_WIDTH = 350;
const NARROW_LIST_WIDTH = 280;

const meta = {
  component: EmptyClosetBand,
  argTypes: {
    onClick: {
      description: '띠를 누르면 알립니다. 옷장에서는 등록 방법 시트를 엽니다.',
    },
  },
  args: {
    onClick: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: LIST_WIDTH }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyClosetBand>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: NARROW_LIST_WIDTH }}>
        <Story />
      </div>
    ),
  ],
};
