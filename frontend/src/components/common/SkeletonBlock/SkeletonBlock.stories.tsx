import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import SkeletonBlock from './SkeletonBlock';

const meta = {
  component: SkeletonBlock,
  argTypes: {
    tone: {
      description:
        '회색의 농도입니다. `light`는 사진 칸처럼 큰 면에, `soft`는 글자 막대처럼 작은 조각에 씁니다.',
      control: 'inline-radio',
      options: ['light', 'soft'],
      table: { defaultValue: { summary: 'soft' } },
    },
    className: {
      description:
        '크기와 모양은 쓰는 곳에서 `styled(SkeletonBlock)`로 정합니다.',
      control: false,
    },
  },
  render: (args) => <Sized {...args} />,
} satisfies Meta<typeof SkeletonBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <StoryStack>
      <StoryLabeled label="light">
        <Sized tone="light" />
      </StoryLabeled>
      <StoryLabeled label="soft">
        <Sized tone="soft" />
      </StoryLabeled>
    </StoryStack>
  ),
};

const Sized = styled(SkeletonBlock)`
  width: 96px;
  height: 120px;
`;
