import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StoryStack from '../../../../.storybook/StoryStack';
import PickerTrigger from './PickerTrigger';

const meta = {
  component: PickerTrigger,
  argTypes: {
    label: {
      description:
        '트리거 위쪽에 작게 보이는 이름입니다. `FormField` 안에 두면 트리거 이름 앞에 그 라벨이 붙고, 안내 문구는 트리거 설명으로 연결됩니다.',
      control: 'text',
    },
    valueText: {
      description:
        '고른 값을 화면에 보이는 문구로 넘깁니다. 고르지 않았으면 넘기지 않고, 그때는 `placeholder`를 보여 줍니다.',
      control: 'text',
    },
    placeholder: {
      description: '`valueText`가 없을 때 트리거에 흐리게 보이는 문구입니다.',
      control: 'text',
    },
    isExpanded: {
      description:
        '트리거가 연 시트가 열려 있는지를 `aria-expanded`로 알립니다. 시트의 열림 상태를 그대로 넘깁니다.',
      control: 'boolean',
    },
    onClick: {
      description: '트리거를 누르면 호출합니다. 여기서 시트를 엽니다.',
    },
    isDisabled: {
      description:
        '트리거를 네이티브 `disabled`로 막고 흐리게 그립니다. 눌러도 `onClick`을 호출하지 않습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    isInvalid: {
      description:
        '고른 값이 받아들여지지 않았음을 테두리 색과 `aria-invalid`로 알립니다. 오류 문구는 트리거 밖에서 보여 주고 `aria-describedby`로 연결합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    'aria-describedby': {
      description:
        '트리거의 설명으로 읽힐 요소의 id입니다. `FormField`의 안내 문구가 있으면 함께 연결합니다.',
      control: 'text',
    },
  },
  args: {
    label: '나가는 시간',
    valueText: '09:00',
    placeholder: '시간 선택',
    isExpanded: false,
    onClick: fn(),
  },
} satisfies Meta<typeof PickerTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    valueText: undefined,
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const Invalid: Story = {
  args: {
    isInvalid: true,
    'aria-describedby': 'picker-trigger-invalid-message',
  },
  render: (args) => (
    <StoryStack direction="column" gap={8}>
      <PickerTrigger {...args} />
      <p id="picker-trigger-invalid-message">
        이 시간에는 추천을 받을 수 없어요.
      </p>
    </StoryStack>
  ),
};
