import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import BirthYearField from './BirthYearField';

const meta = {
  component: BirthYearField,
  argTypes: {
    value: {
      description:
        '고른 출생연도입니다. 아직 고르지 않았으면 `null`이고, 그때는 "선택해 주세요"가 보입니다.',
      control: 'number',
    },
    onChange: {
      description:
        '연도를 고르면 그 연도를 숫자로 알립니다. 목록은 KST 올해−15년부터 올해−100년까지 최신 연도부터 보여 줍니다.',
    },
    errorMessage: {
      description:
        '서버가 연도를 거절했을 때의 안내입니다. 넘기면 테두리가 빨갛게 바뀌고 연령 안내 대신 이 문구를 보여 줍니다.',
      control: 'text',
    },
  },
  args: {
    value: null,
    onChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: number) => {
      args.onChange(value);
      updateArgs({ value, errorMessage: undefined });
    };

    return <BirthYearField {...args} onChange={handleChange} />;
  },
} satisfies Meta<typeof BirthYearField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Selected: Story = {
  args: {
    value: 2001,
  },
};

export const Rejected: Story = {
  args: {
    value: 2011,
    errorMessage: '만 14세 이상만 이용할 수 있습니다.',
  },
};
