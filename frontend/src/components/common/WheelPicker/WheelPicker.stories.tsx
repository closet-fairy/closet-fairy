import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import WheelPicker from './WheelPicker';

const DAY_OPTIONS = [
  { value: 'today', label: '오늘' },
  { value: 'tomorrow', label: '내일' },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  const time = `${hours}:${minutes}`;

  return { value: time, label: time };
});

const meta = {
  component: WheelPicker,
  argTypes: {
    columns: {
      description:
        '나란히 둘 칸입니다. 칸마다 `aria-label`(목록의 접근성 이름), `options`, 고른 값 `value`, 값이 바뀌면 부를 `onChange`를 넘깁니다. 제어형이라 `onChange`로 받은 값을 다시 `value`로 넘겨야 합니다. 굴려서 가운데 띠에 온 칸, 누른 칸, 화살표 키로 옮긴 칸이 바로 `onChange`로 전달됩니다. 칸의 `value`는 그 칸의 `options` 안에 있어야 합니다.',
      control: false,
    },
  },
  args: {
    columns: [],
  },
} satisfies Meta<typeof WheelPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

const handleDayChange = fn();
const handleTimeChange = fn();

export const Default: Story = {
  render: function Render() {
    const [day, setDay] = useState('today');
    const [time, setTime] = useState('09:00');

    return (
      <WheelPicker
        columns={[
          {
            'aria-label': '날짜',
            options: DAY_OPTIONS,
            value: day,
            onChange: (value) => {
              handleDayChange(value);
              setDay(value);
            },
          },
          {
            'aria-label': '시각',
            options: TIME_OPTIONS,
            value: time,
            onChange: (value) => {
              handleTimeChange(value);
              setTime(value);
            },
          },
        ]}
      />
    );
  },
};

export const FewOptions: Story = {
  render: function Render() {
    const [time, setTime] = useState('23:00');

    return (
      <WheelPicker
        columns={[
          {
            'aria-label': '시각',
            options: TIME_OPTIONS.slice(-2),
            value: time,
            onChange: (value) => {
              handleTimeChange(value);
              setTime(value);
            },
          },
        ]}
      />
    );
  },
};
