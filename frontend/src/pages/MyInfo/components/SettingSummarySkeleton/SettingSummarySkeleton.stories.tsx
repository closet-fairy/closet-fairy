import type { Meta, StoryObj } from '@storybook/react-vite';
import SettingSummarySkeleton from './SettingSummarySkeleton';

const meta = {
  component: SettingSummarySkeleton,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingSummarySkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
