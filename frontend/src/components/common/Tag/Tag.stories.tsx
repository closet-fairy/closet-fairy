import type { Meta, StoryObj } from '@storybook/react-vite';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import type { IconName } from '@/assets/icons';
import { icons } from '@/assets/icons';
import Tag from './Tag';

const ICON_NAMES = Object.keys(icons).filter(
  (name): name is IconName => name in icons,
);

const VARIANTS = ['neutral', 'inverse', 'outline'] as const;
const SIZES = ['xs', 'sm', 'md'] as const;

const meta = {
  component: Tag,
  argTypes: {
    children: {
      description:
        '태그에 보이는 글자입니다. 한 줄로 보여 주고, 넘치면 말줄임표로 자릅니다.',
      control: 'text',
    },
    variant: {
      description:
        '태그의 모양입니다. neutral은 연한 회색 바탕, inverse는 진한 바탕에 흰 글자, outline은 바탕 없이 테두리만 둡니다.',
      control: 'inline-radio',
      options: VARIANTS,
      table: { defaultValue: { summary: 'neutral' } },
    },
    size: {
      description:
        '태그의 크기입니다. md와 sm은 알약 모양이고, xs는 썸네일 모서리 배지처럼 아주 작은 표시에 쓰며 모서리를 덜 둥글게 합니다.',
      control: 'inline-radio',
      options: SIZES,
      table: { defaultValue: { summary: 'md' } },
    },
    icon: {
      description:
        '글자 앞에 붙는 아이콘입니다. 장식용이라 스크린리더에서 숨깁니다.',
      control: 'select',
      options: ICON_NAMES,
    },
  },
  args: {
    children: '미니멀',
  },
} satisfies Meta<typeof Tag>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <StoryStack gap={16}>
      {VARIANTS.map((variant) => (
        <StoryLabeled key={variant} label={variant}>
          <Tag {...args} variant={variant} />
        </StoryLabeled>
      ))}
    </StoryStack>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      {VARIANTS.map((variant) => (
        <StoryStack key={variant} gap={16}>
          {SIZES.map((size) => (
            <StoryLabeled key={size} label={`${variant} / ${size}`}>
              <Tag {...args} variant={variant} size={size} />
            </StoryLabeled>
          ))}
        </StoryStack>
      ))}
    </StoryStack>
  ),
};

export const WithIcon: Story = {
  args: {
    variant: 'inverse',
    icon: 'layers',
    children: '2번째 추천',
  },
  render: (args) => (
    <StoryStack gap={16}>
      {SIZES.map((size) => (
        <StoryLabeled key={size} label={size}>
          <Tag {...args} size={size} />
        </StoryLabeled>
      ))}
    </StoryStack>
  ),
};

export const LongText: Story = {
  args: {
    children: '오늘처럼 쌀쌀한 날에 어울리는 차분한 톤의 미니멀 캐주얼 스타일',
  },
  render: (args) => (
    <StoryStack direction="column" gap={12}>
      <Tag {...args} />
      <Tag {...args} variant="inverse" icon="layers" />
    </StoryStack>
  ),
};

export const StyleTags: Story = {
  render: () => (
    <StoryStack gap={6} isWrapped>
      <Tag>캐주얼</Tag>
      <Tag>스트리트</Tag>
      <Tag variant="outline">새로 시도</Tag>
    </StoryStack>
  ),
};

export const StatusBadges: Story = {
  render: () => (
    <StoryStack gap={16}>
      <StoryLabeled label="상태 알약">
        <Tag variant="inverse" size="sm" icon="layers">
          2번째 추천
        </Tag>
      </StoryLabeled>
      <StoryLabeled label="모서리 배지">
        <Tag variant="inverse" size="xs">
          기본
        </Tag>
      </StoryLabeled>
    </StoryStack>
  ),
};
