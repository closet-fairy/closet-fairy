import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import type { IconName } from '@/assets/icons';
import { icons } from '@/assets/icons';
import ListItem from './ListItem';

const ICON_NAMES = Object.keys(icons).filter(
  (name): name is IconName => name in icons,
);

const meta = {
  component: ListItem,
  argTypes: {
    variant: {
      description:
        '모양입니다. `plain`은 아래 구분선만 있는 목록 행이고, `card`는 테두리가 있는 선택지 카드입니다.',
      control: 'inline-radio',
      options: ['plain', 'card'],
      table: { defaultValue: { summary: 'plain' } },
    },
    icon: {
      description:
        '제목 앞에 붙는 장식용 아이콘입니다. `plain`에서는 옅은 색 20px, `card`에서는 진한 색 24px로 그립니다.',
      control: 'select',
      options: ICON_NAMES,
    },
    title: {
      description: '행의 제목입니다.',
      control: 'text',
    },
    description: {
      description: '제목 아래에 작게 붙는 부제입니다.',
      control: 'text',
    },
    hasChevron: {
      description:
        '오른쪽 끝에 `chevron_right` 아이콘을 붙입니다. 다른 화면이나 시트로 넘어가는 행에 씁니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    isDisabled: {
      description:
        '비활성 상태로 흐리게 그립니다. `onClick`이 있으면 버튼을 네이티브 `disabled`로 막습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onClick: {
      description:
        '행을 눌렀을 때 실행합니다. 넘기면 행 전체가 `button`이 되고, 넘기지 않으면 누를 수 없는 `div`로 그립니다. 목록으로 쓸 때는 사용처에서 `ul`/`li`로 감쌉니다.',
    },
  },
  args: {
    title: '서울특별시 성동구',
    icon: 'location_on',
    onClick: fn(),
  },
} satisfies Meta<typeof ListItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Card: Story = {
  args: {
    variant: 'card',
    icon: 'my_location',
    title: '현재 위치 사용',
    description: '위치 권한을 한 번 확인합니다',
    hasChevron: true,
  },
};

export const Variants: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="plain">
        <ListItem {...args} variant="plain" />
      </StoryLabeled>
      <StoryLabeled label="card">
        <ListItem
          {...args}
          variant="card"
          description="위치 권한을 한 번 확인합니다"
          hasChevron
        />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const WithoutIcon: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="plain">
        <ListItem {...args} variant="plain" icon={undefined} />
      </StoryLabeled>
      <StoryLabeled label="card">
        <ListItem
          {...args}
          variant="card"
          icon={undefined}
          title="주소 직접 입력"
          description="시·구 단위까지"
          hasChevron
        />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="plain">
        <ListItem {...args} variant="plain" />
      </StoryLabeled>
      <StoryLabeled label="card">
        <ListItem
          {...args}
          variant="card"
          icon="my_location"
          title="현재 위치 사용"
          description="위치 권한을 한 번 확인합니다"
          hasChevron
        />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const NotClickable: Story = {
  args: {
    onClick: undefined,
  },
};

export const LongText: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="plain">
        <ListItem
          {...args}
          variant="plain"
          title="경상남도 창원시 마산합포구 어느 동네 이름이 아주 길어서 줄이 넘어가는 주소"
        />
      </StoryLabeled>
      <StoryLabeled label="card">
        <ListItem
          {...args}
          variant="card"
          icon="edit_location_alt"
          title="주소를 직접 입력해서 원하는 동네의 날씨로 코디를 추천받기"
          description="시·구 단위까지 입력할 수 있으며, 동 단위 이하의 주소는 시·구 단위로 맞춰서 저장합니다"
          hasChevron
        />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const SearchResults: Story = {
  render: (args) => (
    <ul>
      <li>
        <ListItem {...args} title="서울특별시 성동구" />
      </li>
      <li>
        <ListItem {...args} title="경기도 성남시 분당구" />
      </li>
    </ul>
  ),
};

export const LocationOptions: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={10}>
      <ListItem
        {...args}
        variant="card"
        icon="my_location"
        title="현재 위치 사용"
        description="위치 권한을 한 번 확인합니다"
        hasChevron
      />
      <ListItem
        {...args}
        variant="card"
        icon="edit_location_alt"
        title="주소 직접 입력"
        description="시·구 단위까지"
        hasChevron
      />
    </StoryStack>
  ),
};
