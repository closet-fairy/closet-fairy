import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import Stepper from './Stepper';

const meta = {
  component: Stepper,
  argTypes: {
    steps: {
      description:
        '단계 목록입니다. 앞에서부터 1, 2, 3 번호가 붙고 사이에 › 화살표가 들어가 순서를 보여 줍니다. 순서를 강제하지는 않아 어느 단계든 눌러 바로 이동합니다.',
      control: 'object',
    },
    value: {
      description:
        '지금 단계의 `value`입니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: 'text',
    },
    onChange: {
      description:
        '다른 단계를 누를 때 호출합니다. 새 단계의 `value`를 넘깁니다. 지금 단계를 다시 누르면 호출하지 않습니다.',
    },
    'aria-label': {
      description:
        '스크린리더가 읽을 단계 묶음 이름입니다. 지금 단계는 "현재 단계"로 읽힙니다.',
      control: 'text',
    },
    isDisabled: {
      description:
        '모든 단계를 누를 수 없게 하고 흐리게 보여 줍니다. 저장 중처럼 이동을 막을 때 씁니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    steps: [
      { value: 'brush', label: '브러시' },
      { value: 'perspective', label: '원근' },
      { value: 'rotation', label: '회전' },
    ],
    value: 'brush',
    onChange: fn(),
    'aria-label': '편집 단계',
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: string) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return (
      <div style={{ width: 390 }}>
        <Stepper {...args} onChange={handleChange} />
      </div>
    );
  },
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LastStep: Story = {
  args: {
    value: 'rotation',
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const LongLabels: Story = {
  args: {
    steps: [
      { value: 'brush', label: '배경 지우기와 되살리기' },
      { value: 'perspective', label: '원근 바로잡기' },
      { value: 'rotation', label: '회전과 기울기 조정' },
    ],
  },
};
