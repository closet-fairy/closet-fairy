import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import SkeletonBlock from '@/components/common/SkeletonBlock';
import SkeletonText from '@/components/common/SkeletonText';
import { spacing, typography } from '@/styles/tokens';
import Skeleton from './Skeleton';

const meta = {
  component: Skeleton,
  argTypes: {
    delay: {
      description:
        '빛이 처음 지나가기 시작하는 시점을 늦추는 시간(ms)입니다. 격자의 칸마다 다른 값을 주면 빛이 칸을 차례로 훑고 지나갑니다.',
      control: { type: 'number', min: 0, step: 90 },
      table: { defaultValue: { summary: '0' } },
    },
    className: {
      description:
        '쓰는 곳에서 `styled(Skeleton)`로 카드의 테두리와 안쪽 여백을 입힐 때 씁니다.',
      control: false,
    },
    children: {
      description:
        '회색 칸입니다. 스크린리더에서 숨기므로 안내 문구는 스켈레톤 밖에 따로 둡니다. 나타나기까지 200ms를 기다리므로 그 안에 응답이 오면 보이지 않습니다.',
      control: false,
    },
  },
  args: {
    children: null,
  },
  render: (args) => (
    <Frame>
      <Skeleton {...args}>
        <Photo tone="light" />
        <SkeletonText textStyle={typography.label1} width="78%" />
        <SkeletonText textStyle={typography.caption1} width="42%" />
      </Skeleton>
    </Frame>
  ),
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Delayed: Story = {
  args: { delay: 360 },
};

const Frame = styled.div`
  width: 112px;
`;

const Photo = styled(SkeletonBlock)`
  aspect-ratio: 3 / 4;
  margin-bottom: ${spacing[6]};
`;
