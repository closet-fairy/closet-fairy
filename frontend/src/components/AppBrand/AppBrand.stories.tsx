import type { Meta, StoryObj } from '@storybook/react-vite';
import AppBrand from './AppBrand';

const meta = {
  component: AppBrand,
} satisfies Meta<typeof AppBrand>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
