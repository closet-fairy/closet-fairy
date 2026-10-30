import type { Meta, StoryObj } from '@storybook/react-vite';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import { ICON_NAMES } from '../../../../.storybook/storyIconNames';
import Icon from './Icon';

const meta = {
  component: Icon,
  argTypes: {
    name: {
      description:
        '`assets/icons`에 등록한 아이콘 이름입니다. 새 아이콘은 그 파일에 먼저 등록합니다.',
      control: 'select',
      options: ICON_NAMES,
    },
    size: {
      description:
        '아이콘의 크기입니다. xs 16px, sm 18px, md 20px, lg 24px, xl 36px, 2xl 48px입니다. 색은 따로 받지 않고 부모의 글자색(`currentColor`)을 따릅니다.',
      control: 'inline-radio',
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      table: { defaultValue: { summary: 'md' } },
    },
    label: {
      description:
        '스크린리더가 읽을 이름입니다. 비워 두면 장식용 아이콘으로 보고 스크린리더에서 숨깁니다. 옆에 글자가 함께 있으면 비워 둡니다.',
      control: 'text',
    },
  },
  args: {
    name: 'star_shine',
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="xs">
        <Icon {...args} size="xs" />
      </StoryLabeled>
      <StoryLabeled label="sm">
        <Icon {...args} size="sm" />
      </StoryLabeled>
      <StoryLabeled label="md">
        <Icon {...args} size="md" />
      </StoryLabeled>
      <StoryLabeled label="lg">
        <Icon {...args} size="lg" />
      </StoryLabeled>
      <StoryLabeled label="xl">
        <Icon {...args} size="xl" />
      </StoryLabeled>
      <StoryLabeled label="2xl">
        <Icon {...args} size="2xl" />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const Gallery: Story = {
  render: () => (
    <StoryStack gap={16} isWrapped>
      {ICON_NAMES.map((name) => (
        <StoryLabeled key={name} label={name}>
          <Icon name={name} size="lg" />
        </StoryLabeled>
      ))}
    </StoryStack>
  ),
};
