import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import { ICON_NAMES } from '../../../../.storybook/storyIconNames';
import Button from '@/components/common/Button';
import Notice from './Notice';

const actionExample = (
  <Button
    variant="outline"
    size="sm"
    icon="add_a_photo"
    isFullWidth
    onClick={fn()}
  >
    옷 등록하기
  </Button>
);

const meta = {
  component: Notice,
  argTypes: {
    variant: {
      description:
        '모양입니다. `banner`는 테두리가 있는 안내 상자로 제목·본문·액션을 담고, `subtle`은 배경만 깔린 한 줄짜리 정보 띠입니다.',
      control: 'inline-radio',
      options: ['banner', 'subtle'],
      table: { defaultValue: { summary: 'banner' } },
    },
    icon: {
      description:
        '제목 앞에 붙는 장식용 아이콘입니다. 제목 첫 줄의 높이에 맞춰 세로 가운데에 놓입니다.',
      control: 'select',
      options: ICON_NAMES,
    },
    title: {
      description:
        '안내의 핵심 문장입니다. `subtle`에서는 이 문장 하나만 쓰는 것이 기본입니다.',
      control: 'text',
    },
    description: {
      description: '제목 아래에 붙는 보충 설명입니다.',
      control: 'text',
    },
    action: {
      description:
        '본문 아래에 놓는 액션 자리입니다. 버튼 등을 넘기면 가로를 가득 채워 그립니다. 닫기 버튼은 두지 않습니다.',
      control: false,
    },
  },
  args: {
    icon: 'checkroom',
    title: '등록한 옷이 3벌이라 추천이 단조로울 수 있어요',
    description: '모자란 옷은 기본 아이템으로 채워 추천합니다.',
  },
} satisfies Meta<typeof Notice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Subtle: Story = {
  args: {
    variant: 'subtle',
    icon: 'info',
    title: '오후 6시 소나기 — 겉옷은 방수되는 걸 골랐어요',
    description: undefined,
  },
};

export const Variants: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="banner">
        <Notice {...args} variant="banner" />
      </StoryLabeled>
      <StoryLabeled label="subtle">
        <Notice
          {...args}
          variant="subtle"
          icon="info"
          title="오후 6시 소나기 — 겉옷은 방수되는 걸 골랐어요"
          description={undefined}
        />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const WithAction: Story = {
  args: {
    action: actionExample,
  },
};

export const WithoutIcon: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="banner">
        <Notice {...args} variant="banner" icon={undefined} />
      </StoryLabeled>
      <StoryLabeled label="subtle">
        <Notice
          {...args}
          variant="subtle"
          icon={undefined}
          title="오후 6시 소나기 — 겉옷은 방수되는 걸 골랐어요"
          description={undefined}
        />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const LongText: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="banner">
        <Notice
          {...args}
          variant="banner"
          title="등록한 옷이 3벌뿐이라 상황과 날씨에 맞춘 추천이 단조롭거나 비슷한 조합이 반복될 수 있어요"
          description="모자란 옷은 기본 아이템으로 채워 추천합니다. 옷을 더 등록하면 내 옷장에 있는 옷만으로 더 다양한 코디를 받아볼 수 있습니다."
          action={actionExample}
        />
      </StoryLabeled>
      <StoryLabeled label="subtle">
        <Notice
          {...args}
          variant="subtle"
          icon="info"
          title="오후 6시부터 밤까지 소나기 소식이 있어 겉옷은 방수되는 걸 골랐고, 신발도 젖어도 괜찮은 걸로 바꿨어요"
          description={undefined}
        />
      </StoryLabeled>
    </StoryStack>
  ),
};
