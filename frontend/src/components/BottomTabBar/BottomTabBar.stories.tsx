import type { Meta, StoryObj } from '@storybook/react-vite';
import BottomTabBar from './BottomTabBar';

const meta = {
  component: BottomTabBar,
  parameters: {
    layout: 'fullscreen',
    initialPath: '/recommendation',
  },
} satisfies Meta<typeof BottomTabBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ClosetActive: Story = {
  parameters: { initialPath: '/closet' },
};

export const RecommendationHistoryActive: Story = {
  parameters: { initialPath: '/recommendation-history' },
};

export const MyInfoActive: Story = {
  parameters: { initialPath: '/my-info' },
};

export const NestedPathActive: Story = {
  parameters: { initialPath: '/recommendation/result' },
};
