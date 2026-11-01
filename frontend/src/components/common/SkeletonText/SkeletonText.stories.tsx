import type { Meta, StoryObj } from '@storybook/react-vite';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import { typography } from '@/styles/tokens';
import SkeletonText from './SkeletonText';

const meta = {
  component: SkeletonText,
  argTypes: {
    textStyle: {
      description:
        '이 줄에 실제로 들어갈 글자 스타일 토큰입니다. 줄 높이는 이 스타일의 줄 높이와 같고, 회색 막대만 글자 크기로 그립니다.',
      control: false,
    },
    width: {
      description:
        '회색 막대의 너비입니다. 줄 너비에 대한 비율이나 길이를 씁니다.',
      control: 'text',
      table: { defaultValue: { summary: '100%' } },
    },
    className: {
      description: '쓰는 곳에서 줄의 정렬이나 폭을 바꿀 때 씁니다.',
      control: false,
    },
  },
  args: {
    textStyle: typography.body1,
    width: '60%',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SkeletonText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TextStyles: Story = {
  render: () => (
    <StoryStack direction="column">
      <StoryLabeled label="title2">
        <SkeletonText textStyle={typography.title2} width="50%" />
      </StoryLabeled>
      <StoryLabeled label="body2">
        <SkeletonText textStyle={typography.body2} width="70%" />
      </StoryLabeled>
      <StoryLabeled label="caption1">
        <SkeletonText textStyle={typography.caption1} width="40%" />
      </StoryLabeled>
    </StoryStack>
  ),
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
};
