import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import CheckList from './CheckList';
import type { CheckListItem } from './CheckList';

const ITEMS: CheckListItem[] = [
  { value: 'minimal', label: '미니멀', description: '단정하고 군더더기 없는' },
  { value: 'casual', label: '캐주얼', description: '편하게 매일 입는' },
  { value: 'street', label: '스트릿', description: '거리에서 눈에 띄는' },
  { value: 'classic', label: '클래식', description: '유행을 타지 않는' },
  { value: 'formal', label: '포멀', description: '격식을 갖춘 자리에' },
];

const meta = {
  component: CheckList,
  argTypes: {
    items: {
      description:
        '항목 목록입니다. `value`는 선택 값, `label`은 굵게 보이는 이름, `description`은 이름 아래 한 줄 설명입니다.',
      control: false,
    },
    value: {
      description:
        '선택된 항목들의 `value` 배열입니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: 'object',
    },
    onChange: {
      description:
        '항목을 눌러 선택이 바뀔 때 호출합니다. 바뀐 뒤의 선택 값 배열 전체를 넘깁니다. 고른 항목을 다시 누르면 선택이 풀립니다.',
    },
    'aria-label': {
      description:
        '스크린리더가 읽을 목록 이름입니다. 화면에 보이는 제목이 따로 있으면 이 대신 `aria-labelledby`를 씁니다.',
      control: 'text',
    },
    'aria-labelledby': {
      description:
        '목록 이름으로 쓸 요소의 `id`입니다. `FormField` 안에서는 그 라벨이 자동으로 이름이 됩니다.',
      control: 'text',
    },
    isDisabled: {
      description: '모든 항목을 누를 수 없게 하고 흐리게 보여 줍니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    items: ITEMS,
    value: ['minimal', 'classic'],
    onChange: fn(),
    'aria-label': '선호 스타일',
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: string[]) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return <CheckList {...args} onChange={handleChange} />;
  },
} satisfies Meta<typeof CheckList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSelection: Story = {
  args: {
    value: [],
  },
};

export const WithoutDescription: Story = {
  args: {
    items: ITEMS.map(({ value, label }) => ({ value, label })),
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};
