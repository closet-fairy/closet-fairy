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

export const CustomLabel: Story = {
  args: { label: '추천 내역을 불러오는 중이에요' },
};
