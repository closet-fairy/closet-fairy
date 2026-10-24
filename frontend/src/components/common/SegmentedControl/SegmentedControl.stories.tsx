import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import SegmentedControl from './SegmentedControl';

const meta = {
  component: SegmentedControl,
  argTypes: {
    options: {
      description:
        '고를 수 있는 항목입니다. `value`는 구분용 값, `label`은 화면 글자, `icon`은 글자 앞에 붙일 아이콘 이름입니다.',
      control: 'object',
    },
    value: {
      description:
        '선택된 항목의 `value`입니다. 늘 하나는 선택돼 있어야 합니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: 'text',
    },
    onChange: {
      description:
        '다른 항목을 눌러 선택이 바뀔 때 호출합니다. 새로 고른 항목의 `value`를 넘깁니다. 이미 선택된 항목을 다시 누르면 해제되지 않고 호출되지도 않습니다.',
    },
    'aria-label': {
      description: '스크린리더가 읽을 묶음 이름입니다.',
      control: 'text',
    },
    isDisabled: {
      description: '모든 항목을 누를 수 없게 하고 흐리게 보여 줍니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    options: [
      { value: 'erase', label: '지우기', icon: 'ink_eraser' },
      { value: 'restore', label: '되살리기', icon: 'brush' },
    ],
    value: 'erase',
    onChange: fn(),
    'aria-label': '브러시 모드',
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: string) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return (
      <div style={{ width: 280 }}>
        <SegmentedControl {...args} onChange={handleChange} />
      </div>
    );
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondSelected: Story = {
  args: {
    value: 'restore',
  },
};

export const WithoutIcon: Story = {
  args: {
    options: [
      { value: 'day', label: '오늘' },
      { value: 'week', label: '이번 주' },
      { value: 'month', label: '이번 달' },
    ],
    value: 'day',
    'aria-label': '기간',
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};
