import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  createEndDayOptions,
  createStartDayOptions,
} from '@/domains/recommendation/goingOutTime';
import GoingOutTimeField from './GoingOutTimeField';

const NOW = new Date('2026-10-14T21:10:00+09:00');
const DAY_LABELS: Readonly<Record<string, string>> = {
  '2026-10-14': '오늘',
  '2026-10-15': '내일',
  '2026-10-16': '모레',
};

const getDayLabel = (date: string) => DAY_LABELS[date] ?? date;

const meta = {
  component: GoingOutTimeField,
  argTypes: {
    label: {
      description:
        '트리거 위쪽 이름이자 시트 제목입니다. 예: 나가는 시간, 돌아오는 시간',
      control: 'text',
    },
    valueText: {
      description:
        '트리거에 보이는 고른 값입니다. 오늘이면 시각만, 그 밖의 날은 "내일 02:00"처럼 날짜를 붙여 넘깁니다.',
      control: 'text',
    },
    description: {
      description:
        '시트 제목 아래 설명입니다. 돌아오는 시간에서 날짜 휠의 기준이 되는 나가는 시간을 보여 줄 때 씁니다.',
      control: 'text',
    },
    days: {
      description:
        '날짜 휠에 둘 날짜와 날짜마다 고를 수 있는 시각입니다. 시트를 여는 순간의 값으로 고정되어, 연 동안 시각이 지나도 범위가 바뀌지 않습니다.',
      control: 'object',
    },
    value: {
      description:
        '고른 날짜(KST `YYYY-MM-DD`)와 시각입니다. 시트를 열면 `days` 범위 안으로 맞춘 값에서 시작합니다.',
      control: 'object',
    },
    getDayLabel: {
      description:
        '날짜를 날짜 휠과 선택 버튼에 보일 이름(오늘·내일·모레)으로 바꿉니다.',
      control: false,
    },
    onConfirm: {
      description:
        '선택 버튼을 누르면 휠에서 고른 날짜와 시각으로 호출하고 시트를 닫습니다. 버튼 없이 닫으면 호출하지 않고 바꾼 값을 버립니다.',
    },
  },
  args: {
    label: '나가는 시간',
    valueText: '21:00',
    days: createStartDayOptions(NOW),
    value: { date: '2026-10-14', time: '21:00' },
    getDayLabel,
    onConfirm: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '480px' } },
  },
} satisfies Meta<typeof GoingOutTimeField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Start: Story = {};

export const StartOpened: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /나가는 시간/ }));
  },
};

export const End: Story = {
  args: {
    label: '돌아오는 시간',
    valueText: '내일 02:00',
    description: '나가는 시간 오늘 21:00',
    days: createEndDayOptions({ date: '2026-10-14', time: '21:00' }),
    value: { date: '2026-10-15', time: '02:00' },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /돌아오는 시간/ }),
    );
  },
};

export const EndAfterTomorrowStart: Story = {
  args: {
    label: '돌아오는 시간',
    valueText: '내일 13:30',
    description: '나가는 시간 내일 08:30',
    days: createEndDayOptions({ date: '2026-10-15', time: '08:30' }),
    value: { date: '2026-10-15', time: '13:30' },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /돌아오는 시간/ }),
    );
  },
};
