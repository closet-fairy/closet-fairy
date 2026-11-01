import type { Meta, StoryObj } from '@storybook/react-vite';
import ClothingDetailSkeleton from './ClothingDetailSkeleton';

const meta = {
  component: ClothingDetailSkeleton,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClothingDetailSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
