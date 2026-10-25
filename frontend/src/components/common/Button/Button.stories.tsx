import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import { ICON_NAMES } from '../../../../.storybook/storyIconNames';
import Button from './Button';

const meta = {
  component: Button,
  argTypes: {
    children: {
      description: '버튼에 보이는 글자입니다.',
      control: 'text',
    },
    variant: {
      description:
        '버튼의 모양입니다. primary는 주요 동작, outline은 보조 동작, text는 닫기처럼 가벼운 동작에 씁니다.',
      control: 'inline-radio',
      options: ['primary', 'outline', 'text'],
      table: { defaultValue: { summary: 'primary' } },
    },
    size: {
      description:
        '버튼의 크기입니다. lg 54px는 화면과 시트 하단 버튼, md 48px는 보조 버튼, sm 40px는 배너 안 버튼에 씁니다. 글자가 길어 줄이 바뀌면 높이가 늘어납니다.',
      control: 'inline-radio',
      options: ['lg', 'md', 'sm'],
      table: { defaultValue: { summary: 'lg' } },
    },
    icon: {
      description:
        '글자 앞에 붙는 아이콘입니다. 크기는 버튼 크기를 따르고, 장식용이라 스크린리더에서 숨깁니다.',
      control: 'select',
      options: ICON_NAMES,
    },
    isFullWidth: {
      description: '부모 너비를 꽉 채울지 정합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    isDisabled: {
      description:
        '누를 수 없게 합니다. 네이티브 `disabled`를 걸어 포커스와 클릭을 막고 흐리게 보여 줍니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    isLoading: {
      description:
        '요청을 보내는 중임을 보여 줍니다. 글자 대신 도는 아이콘을 보여 주되 버튼 너비는 그대로 두고, 흐리게 하지 않은 채 누름만 막습니다. 스크린리더에는 `aria-busy`로 알립니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    type: {
      description: '네이티브 `type`입니다. 폼 제출 버튼에만 submit을 줍니다.',
      control: 'inline-radio',
      options: ['button', 'submit', 'reset'],
      table: { defaultValue: { summary: 'button' } },
    },
    onClick: {
      description:
        '버튼을 누르면 호출됩니다. 비활성 상태에서는 호출되지 않습니다.',
    },
    ref: {
      description: '네이티브 `button` 요소에 연결할 ref입니다.',
      control: false,
    },
    id: {
      description:
        '네이티브 `button`의 id입니다. 다른 요소의 `aria-labelledby`나 `aria-controls`가 이 버튼을 가리킬 때 씁니다.',
      control: 'text',
    },
    'aria-label': {
      description:
        '보이는 글자만으로 버튼이 하는 일을 알기 어려울 때 스크린리더가 대신 읽을 이름입니다. 보이는 글자로 충분하면 넘기지 않습니다.',
      control: 'text',
    },
    'aria-expanded': {
      description:
        '이 버튼이 여닫는 영역(시트, 펼침 목록 등)이 지금 열려 있는지 알립니다. 여닫는 버튼이 아니면 넘기지 않습니다.',
      control: 'boolean',
    },
    'aria-pressed': {
      description:
        '눌림 상태를 유지하는 토글 버튼일 때 지금 켜져 있는지 알립니다. 토글 버튼이 아니면 넘기지 않습니다.',
      control: 'inline-radio',
      options: [true, false, 'mixed'],
    },
    'aria-haspopup': {
      description:
        '누르면 메뉴, 목록, 대화상자 같은 팝업이 뜬다는 것을 알립니다. 값은 뜨는 팝업의 종류입니다.',
      control: 'select',
      options: [true, false, 'menu', 'listbox', 'tree', 'grid', 'dialog'],
    },
    'aria-controls': {
      description: '이 버튼이 조작하는 영역의 id입니다.',
      control: 'text',
    },
    'aria-describedby': {
      description: '버튼의 설명으로 읽힐 요소의 id입니다.',
      control: 'text',
    },
  },
  args: {
    children: '코디 추천 받기',
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="primary">
        <Button {...args} variant="primary" />
      </StoryLabeled>
      <StoryLabeled label="outline">
        <Button {...args} variant="outline" />
      </StoryLabeled>
      <StoryLabeled label="text">
        <Button {...args} variant="text" />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      {(['primary', 'outline', 'text'] as const).map((variant) => (
        <StoryStack key={variant} gap={16}>
          <StoryLabeled label={`${variant} / lg`}>
            <Button {...args} variant={variant} size="lg" />
          </StoryLabeled>
          <StoryLabeled label={`${variant} / md`}>
            <Button {...args} variant={variant} size="md" />
          </StoryLabeled>
          <StoryLabeled label={`${variant} / sm`}>
            <Button {...args} variant={variant} size="sm" />
          </StoryLabeled>
        </StoryStack>
      ))}
    </StoryStack>
  ),
};

export const WithIcon: Story = {
  args: {
    icon: 'star_shine',
  },
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="lg">
        <Button {...args} size="lg" />
      </StoryLabeled>
      <StoryLabeled label="md">
        <Button {...args} size="md" />
      </StoryLabeled>
      <StoryLabeled label="sm">
        <Button {...args} size="sm" />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="primary">
        <Button {...args} variant="primary" />
      </StoryLabeled>
      <StoryLabeled label="outline">
        <Button {...args} variant="outline" />
      </StoryLabeled>
      <StoryLabeled label="text">
        <Button {...args} variant="text" />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const Loading: Story = {
  args: {
    isLoading: true,
    children: '계속',
  },
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="primary / md">
        <Button {...args} variant="primary" size="md" />
      </StoryLabeled>
      <StoryLabeled label="outline / lg">
        <Button {...args} variant="outline" size="lg" />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const FullWidth: Story = {
  args: {
    isFullWidth: true,
  },
};

export const LongText: Story = {
  args: {
    icon: 'star_shine',
    isFullWidth: true,
    children:
      '오늘 날씨와 일정에 맞춰 옷장 속 옷으로 코디를 추천받고 마음에 들면 바로 저장하기',
  },
};

export const RecommendationFooter: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={12}>
      <Button {...args} icon="star_shine" size="lg" isFullWidth>
        코디 추천 받기
      </Button>
      <Button {...args} variant="outline" icon="refresh" size="md" isFullWidth>
        말로 바꿔 달래기
      </Button>
      <Button {...args} variant="text" size="md" isFullWidth>
        다시 볼게요
      </Button>
    </StoryStack>
  ),
};

export const BannerAction: Story = {
  args: {
    variant: 'outline',
    size: 'sm',
    icon: 'add_a_photo',
    isFullWidth: true,
    children: '옷 등록하기',
  },
};
