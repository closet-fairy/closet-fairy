import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import type { IconName } from '@/assets/icons';
import { icons } from '@/assets/icons';
import IconButton from './IconButton';

const ICON_NAMES = Object.keys(icons).filter(
  (name): name is IconName => name in icons,
);

const meta = {
  component: IconButton,
  argTypes: {
    icon: {
      description: '버튼에 보이는 아이콘입니다.',
      control: 'select',
      options: ICON_NAMES,
    },
    'aria-label': {
      description:
        '스크린리더가 읽을 버튼 이름입니다. 글자 없이 아이콘만 보이므로 반드시 적습니다.',
      control: 'text',
    },
    variant: {
      description:
        '버튼의 모양입니다. plain은 아이콘만 보이고 색은 부모의 글자색을 따릅니다. circle은 흰 원형 배경 위에 아이콘을 올려 사진 위 화살표처럼 배경과 구분해야 할 때 씁니다.',
      control: 'inline-radio',
      options: ['plain', 'circle'],
      table: { defaultValue: { summary: 'plain' } },
    },
    iconSize: {
      description:
        '아이콘의 크기입니다. xs 16px, sm 18px, md 20px, lg 24px, xl 36px입니다. 보이는 크기와 상관없이 누를 수 있는 영역은 44×44px 이상으로 잡습니다.',
      control: 'inline-radio',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      table: { defaultValue: { summary: 'lg' } },
    },
    isDisabled: {
      description:
        '누를 수 없게 합니다. 네이티브 `disabled`를 걸어 포커스와 클릭을 막고 흐리게 보여 줍니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
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
    icon: 'close',
    'aria-label': '닫기',
    onClick: fn(),
  },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  args: {
    icon: 'chevron_right',
    'aria-label': '다음',
  },
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="plain">
        <IconButton {...args} variant="plain" />
      </StoryLabeled>
      <StoryLabeled label="circle">
        <IconButton {...args} variant="circle" />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const IconSizes: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      {(['plain', 'circle'] as const).map((variant) => (
        <StoryStack key={variant} gap={16}>
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <StoryLabeled key={size} label={`${variant} / ${size}`}>
              <IconButton {...args} variant={variant} iconSize={size} />
            </StoryLabeled>
          ))}
        </StoryStack>
      ))}
    </StoryStack>
  ),
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    icon: 'chevron_left',
    'aria-label': '이전',
  },
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="plain">
        <IconButton {...args} variant="plain" />
      </StoryLabeled>
      <StoryLabeled label="circle">
        <IconButton {...args} variant="circle" />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const WireframeUsages: Story = {
  render: (args) => (
    <StoryStack gap={16}>
      <StoryLabeled label="시트 닫기">
        <IconButton {...args} icon="close" aria-label="닫기" iconSize="lg" />
      </StoryLabeled>
      <StoryLabeled label="뒤로 가기">
        <IconButton
          {...args}
          icon="arrow_back"
          aria-label="뒤로 가기"
          iconSize="lg"
        />
      </StoryLabeled>
      <StoryLabeled label="검색어 지우기">
        <IconButton
          {...args}
          icon="cancel"
          aria-label="검색어 지우기"
          iconSize="sm"
        />
      </StoryLabeled>
      <StoryLabeled label="이전 코디">
        <IconButton
          {...args}
          icon="chevron_left"
          aria-label="이전 코디"
          variant="circle"
        />
      </StoryLabeled>
      <StoryLabeled label="다음 코디">
        <IconButton
          {...args}
          icon="chevron_right"
          aria-label="다음 코디"
          variant="circle"
        />
      </StoryLabeled>
    </StoryStack>
  ),
};
