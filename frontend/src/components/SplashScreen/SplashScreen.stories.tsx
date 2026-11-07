import type { Meta, StoryObj } from '@storybook/react-vite';
import SplashBackground from '@/components/SplashBackground';
import SplashScreen from './SplashScreen';

const meta = {
  component: SplashScreen,
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
} satisfies Meta<typeof SplashScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
