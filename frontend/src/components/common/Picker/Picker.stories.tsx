import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs, useState } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import StoryStack from '../../../../.storybook/StoryStack';
import Icon from '@/components/common/Icon';
import Picker from './Picker';

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  const time = `${hours}:${minutes}`;

  return { value: time, label: time };
});

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'rating', label: '별점 높은순' },
];

const meta = {
  component: Picker,
  argTypes: {
    label: {
      description:
        '트리거 위쪽에 작게 보이는 이름입니다. 시트 제목과 목록의 접근성 이름으로도 쓰입니다. `FormField` 안에 두면 트리거 이름 앞에 그 라벨이 붙고, 안내 문구는 트리거 설명으로 연결됩니다.',
      control: 'text',
    },
    options: {
      description:
        '시트 목록에 보여 줄 선택지입니다. `value`는 선택지마다 달라야 하고, `label`은 목록과 트리거에 그대로 보입니다.',
      control: 'object',
    },
    value: {
      description:
        '선택된 선택지의 `value`입니다. 제어형이라 `onChange`로 받은 값을 다시 넘겨야 하며, 고르지 않았으면 `null`을 넘깁니다.',
      control: 'text',
    },
    onChange: {
      description:
        '목록에서 다른 선택지를 누르면 호출합니다. 이벤트 객체가 아니라 새로 고른 선택지의 `value` 문자열을 넘깁니다. 이미 선택된 선택지를 누르면 호출하지 않고 시트만 닫습니다.',
    },
    placeholder: {
      description:
        '선택된 값이 없을 때 트리거에 흐리게 보이는 문구입니다. `value`가 `options`에 없을 때도 이 문구를 보여 줍니다.',
      control: 'text',
    },
    isDisabled: {
      description:
        '트리거를 네이티브 `disabled`로 막고 흐리게 그립니다. 시트를 열 수 없습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    label: '나가는 시간',
    options: TIME_OPTIONS,
    value: '09:00',
    onChange: fn(),
    placeholder: '시간 선택',
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: string) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return <Picker {...args} onChange={handleChange} />;
  },
} satisfies Meta<typeof Picker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Opened: Story = {
  parameters: {
    docs: { story: { inline: false, height: '480px' } },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /나가는 시간/ }));
  },
};

export const Empty: Story = {
  args: {
    value: null,
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const ShortList: Story = {
  args: {
    label: '정렬',
    options: SORT_OPTIONS,
    value: 'latest',
  },
};

export const ShortListOpened: Story = {
  args: {
    label: '정렬',
    options: SORT_OPTIONS,
    value: 'latest',
  },
  parameters: {
    docs: { story: { inline: false, height: '480px' } },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /정렬/ }));
  },
};

export const OutingTime: Story = {
  render: function Render(args) {
    const [startTime, setStartTime] = useState<string | null>('09:00');
    const [endTime, setEndTime] = useState<string | null>('14:00');

    const handleStartTimeChange = (value: string) => {
      args.onChange(value);
      setStartTime(value);
    };

    const handleEndTimeChange = (value: string) => {
      args.onChange(value);
      setEndTime(value);
    };

    return (
      <StoryStack gap={10}>
        <Picker
          label="나가는 시간"
          options={TIME_OPTIONS}
          value={startTime}
          onChange={handleStartTimeChange}
        />
        <Icon name="arrow_forward" size="sm" />
        <Picker
          label="돌아오는 시간"
          options={TIME_OPTIONS}
          value={endTime}
          onChange={handleEndTimeChange}
        />
      </StoryStack>
    );
  },
};
