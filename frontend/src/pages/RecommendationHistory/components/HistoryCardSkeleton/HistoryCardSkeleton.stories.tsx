import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { spacing } from '@/styles/tokens';
import HistoryCardSkeleton from './HistoryCardSkeleton';

const meta = {
  component: HistoryCardSkeleton,
  argTypes: {
    index: {
      description:
        '목록에서 이 카드가 놓이는 순서입니다. 카드마다 140ms씩 늦게 빛이 지나갑니다. 날씨 줄이 있는 카드의 모양을 기준으로 합니다.',
      control: { type: 'number', min: 0 },
    },
  },
  args: { index: 0 },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HistoryCardSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const List: Story = {
  render: () => (
    <ListLayout>
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <HistoryCardSkeleton index={index} />
        </li>
      ))}
    </ListLayout>
  ),
};

const ListLayout = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]};
`;
