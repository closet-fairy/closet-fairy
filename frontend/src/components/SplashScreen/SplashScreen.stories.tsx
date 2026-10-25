import type { Meta, StoryObj } from '@storybook/react-vite';
import SplashScreen from './SplashScreen';

const meta = {
  component: SplashScreen,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SplashScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
