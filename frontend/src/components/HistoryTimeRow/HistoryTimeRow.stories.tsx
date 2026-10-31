import type { Meta, StoryObj } from '@storybook/react-vite';
import HistoryTimeRow from './HistoryTimeRow';

const NARROW_WIDTH = 200;

const meta = {
  component: HistoryTimeRow,
  argTypes: {
    size: {
      description:
        'sm은 추천 내역 목록의 카드에, md는 추천 내역 상세에 씁니다.',
      control: 'inline-radio',
      options: ['md', 'sm'],
      table: { defaultValue: { summary: 'sm' } },
    },
  },
  args: { icon: 'schedule', label: '추천', value: '오늘 10:12' },
} satisfies Meta<typeof HistoryTimeRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RecommendedAt: Story = {};

export const GoingOut: Story = {
  args: { icon: 'event', label: '외출', value: '내일 18:00 · 서울 성동구' },
};

export const Large: Story = {
  args: {
    icon: 'event',
    label: '외출',
    value: '오늘 18:00 – 다음 날 00:30 · 서울 성동구',
    size: 'md',
  },
};

export const Overflow: Story = {
  args: {
    icon: 'event',
    label: '외출',
    value: '2026. 8. 23 18:00 · 경기 고양시 덕양구',
  },
  decorators: [
    (Story) => (
      <div style={{ width: NARROW_WIDTH }}>
        <Story />
      </div>
    ),
  ],
};
