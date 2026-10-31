import type { Meta, StoryObj } from '@storybook/react-vite';
import EstimatedBadge from './EstimatedBadge';

const meta = {
  component: EstimatedBadge,
} satisfies Meta<typeof EstimatedBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
