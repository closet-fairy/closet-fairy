import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import type { StyleCd } from '@/domains/member/memberSettingOptions';
import StylePreferenceList from './StylePreferenceList';

const meta = {
  component: StylePreferenceList,
  argTypes: {
    value: {
      description: '고른 스타일 코드 배열입니다. 개수 제한은 없습니다.',
      control: 'object',
    },
    onChange: {
      description:
        '스타일을 고르거나 풀 때 바뀐 뒤의 코드 배열 전체로 알립니다.',
    },
    'aria-label': {
      description: '스크린리더가 읽을 목록 이름입니다.',
      control: 'text',
    },
    'aria-labelledby': {
      description: '목록 이름으로 쓸 요소의 `id`입니다.',
      control: 'text',
    },
    isDisabled: {
      description: '모든 스타일을 누를 수 없게 합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    value: ['minimal', 'classic'],
    onChange: fn(),
    'aria-label': '선호 스타일',
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: StyleCd[]) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return <StylePreferenceList {...args} onChange={handleChange} />;
  },
} satisfies Meta<typeof StylePreferenceList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSelection: Story = {
  args: {
    value: [],
  },
};
