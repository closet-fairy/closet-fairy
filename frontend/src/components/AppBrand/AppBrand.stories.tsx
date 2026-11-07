import type { Meta, StoryObj } from '@storybook/react-vite';
import SplashBackground from '@/components/SplashBackground';
import AppBrand from './AppBrand';

const meta = {
  component: AppBrand,
  decorators: [
    (Story) => (
      <SplashBackground>
        <Story />
      </SplashBackground>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AppBrand>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
