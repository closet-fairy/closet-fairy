import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ICON_NAMES } from '../../../../.storybook/storyIconNames';
import ChipGroup from '@/components/common/ChipGroup';
import Chip from './Chip';

const meta = {
  component: Chip,
  argTypes: {
    value: {
      description:
        '묶음 안에서 칩을 구분하는 값입니다. `ChipGroup`의 `value`와 같으면 선택된 모양이 됩니다.',
      control: 'text',
    },
    children: {
      description:
        '칩에 보이는 글자입니다. 칩 너비를 넘으면 말줄임표로 줄입니다.',
      control: 'text',
    },
    trailingIcon: {
      description:
        '글자 뒤에 붙는 16px 아이콘입니다. 장식용이라 스크린리더에서 숨깁니다.',
      control: 'select',
      options: ICON_NAMES,
    },
    variant: {
      description:
        '칩의 모양입니다. solid는 일반 선택지, dashed는 "직접 입력"처럼 다른 동작으로 이어지는 선택지에 씁니다. 선택되면 둘 다 같은 모양입니다.',
      control: 'inline-radio',
      options: ['solid', 'dashed'],
      table: { defaultValue: { summary: 'solid' } },
    },
    isDisabled: {
      description: '이 칩만 누를 수 없게 하고 흐리게 보여 줍니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onClick: {
      description:
        '칩을 누를 때마다 인자 없이 호출합니다. 이 함수를 넘기면 눌러도 선택이 바뀌지 않고 `ChipGroup`의 `onChange`도 불리지 않으므로, 이미 선택된 칩을 다시 눌러도 호출됩니다. "직접 입력"처럼 다른 동작으로 이어지는 칩에 쓰고, 선택 여부는 `ChipGroup`의 `value`로 정합니다.',
    },
  },
  args: {
    value: '출근',
    children: '출근',
  },
  render: (args) => (
    <ChipGroup aria-label="칩 예시" value={null} onChange={fn()}>
      <Chip {...args} />
    </ChipGroup>
  ),
} satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  render: (args) => (
    <ChipGroup aria-label="칩 예시" value={args.value} onChange={fn()}>
      <Chip {...args} />
    </ChipGroup>
  ),
};

export const Dashed: Story = {
  args: {
    value: 'custom',
    children: '직접 입력',
    variant: 'dashed',
    trailingIcon: 'edit',
    onClick: fn(),
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const LongLabel: Story = {
  args: {
    children:
      '친구 결혼식 끝나고 바로 이어지는 저녁 모임까지 한 벌로 버텨야 하는 날',
  },
};
