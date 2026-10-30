import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import TextArea from './TextArea';

const FIELD_WIDTH = 340;

const meta = {
  component: TextArea,
  argTypes: {
    value: {
      description:
        '입력값입니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: 'text',
    },
    onChange: { description: '입력값이 바뀌면 호출됩니다.' },
    placeholder: { description: '비어 있을 때 보여 줄 안내입니다.' },
    maxLength: {
      description:
        '글자 수 카운터의 기준입니다. 넘어도 입력을 막지 않고 카운터만 빨갛게 바꿉니다.',
      control: 'number',
    },
    errorMessage: {
      description:
        '값이 있으면 테두리를 빨갛게 바꾸고 아래에 문구를 보여 줍니다.',
      control: 'text',
    },
    isDisabled: { description: '입력을 막습니다.', control: 'boolean' },
    ref: { description: '`textarea` 요소에 연결합니다.' },
    'aria-label': { description: '화면 낭독기가 읽을 이름입니다.' },
  },
  args: {
    value: '',
    onChange: fn(),
    'aria-label': '요청 내용',
  },
  decorators: [
    (Story) => (
      <div style={{ width: FIELD_WIDTH }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    return <TextArea {...args} onChange={(value) => updateArgs({ value })} />;
  },
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCounter: Story = {
  args: { value: '좀 더 캐주얼하게, 검정색 줄여줘', maxLength: 300 },
};

export const OverLimit: Story = {
  args: { value: '가'.repeat(12), maxLength: 10 },
};

export const WithError: Story = {
  args: {
    value: '음',
    maxLength: 300,
    errorMessage: '요청을 이해하지 못했습니다. 다시 말씀해 주세요.',
  },
};

export const Disabled: Story = {
  args: { value: '좀 더 캐주얼하게', isDisabled: true },
};
