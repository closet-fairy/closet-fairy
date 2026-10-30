import type { Meta, StoryObj } from '@storybook/react-vite';
import OutfitLoading from './OutfitLoading';

const meta = {
  component: OutfitLoading,
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', height: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OutfitLoading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
