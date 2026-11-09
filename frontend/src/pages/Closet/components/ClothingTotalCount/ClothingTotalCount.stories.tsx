import type { Meta, StoryObj } from '@storybook/react-vite';
import TopBar from '@/components/common/TopBar';
import ClothingTotalCount from './ClothingTotalCount';

const meta = {
  component: ClothingTotalCount,
  argTypes: {
    count: {
      description:
        '서버에 등록된 옷의 전체 개수입니다. null이면 아직 모르는 값이라 숫자 자리에 스켈레톤을 그립니다.',
    },
  },
  args: { count: 12 },
  decorators: [
    (Story, context) => (
      <TopBar title="옷장" trailing={<Story {...context} />} />
    ),
  ],
} satisfies Meta<typeof ClothingTotalCount>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Zero: Story = { args: { count: 0 } };

export const Thousands: Story = { args: { count: 1234 } };

export const Loading: Story = { args: { count: null } };
