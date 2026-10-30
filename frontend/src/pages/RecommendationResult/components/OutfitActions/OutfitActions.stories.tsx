import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import OutfitActions from './OutfitActions';

const meta = {
  component: OutfitActions,
  argTypes: {
    onInfoClick: { description: '[정보 확인]을 누르면 호출됩니다.' },
  },
  args: {
    onInfoClick: fn(),
  },
} satisfies Meta<typeof OutfitActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
