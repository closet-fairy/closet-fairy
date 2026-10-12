import type { Meta, StoryObj } from '@storybook/react-vite';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import PageIndicator from './PageIndicator';

const meta = {
  component: PageIndicator,
  argTypes: {
    count: {
      description: '전체 페이지 수입니다. 점이 이 수만큼 그려집니다.',
      control: { type: 'number', min: 1, step: 1 },
    },
    index: {
      description:
        '현재 페이지의 순서(0부터)입니다. 이 위치의 점이 길게 강조됩니다. 누를 수 없는 표시 전용 요소입니다.',
      control: { type: 'number', min: 0, step: 1 },
    },
    isDecorative: {
      description:
        '장식용으로 보고 스크린리더에서 숨깁니다. 근처에 "1 / 4" 같은 위치 표시가 따로 있으면 켜 둡니다. 끄면 "4개 중 1번째"처럼 읽힙니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
  },
  args: {
    count: 4,
    index: 0,
  },
} satisfies Meta<typeof PageIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Positions: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={16}>
      {Array.from({ length: args.count }, (_, index) => (
        <StoryLabeled key={index} label={`${index + 1} / ${args.count}`}>
          <PageIndicator {...args} index={index} />
        </StoryLabeled>
      ))}
    </StoryStack>
  ),
};

export const ManyPages: Story = {
  args: {
    count: 8,
    index: 5,
  },
};

export const Labeled: Story = {
  args: {
    isDecorative: false,
  },
};
