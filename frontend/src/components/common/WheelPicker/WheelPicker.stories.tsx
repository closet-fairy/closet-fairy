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
    columns: [
      {
        'aria-label': '날짜',
        options: DAY_OPTIONS,
        value: 'today',
        onChange: fn(),
      },
      {
        'aria-label': '시각',
        options: TIME_OPTIONS,
        value: '09:00',
        onChange: fn(),
      },
    ],
  },
  render: function Render(args) {
    const [values, setValues] = useState(() =>
      args.columns.map((column) => column.value),
    );

    const handleChange = (columnIndex: number, value: string) => {
      args.columns[columnIndex]?.onChange(value);
      setValues((prev) =>
        prev.map((prevValue, index) =>
          index === columnIndex ? value : prevValue,
        ),
      );
    };

    return (
      <WheelPicker
        columns={args.columns.map((column, columnIndex) => ({
          ...column,
          value: values[columnIndex] ?? column.value,
          onChange: (value) => handleChange(columnIndex, value),
        }))}
      />
    );
  },
} satisfies Meta<typeof WheelPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FewOptions: Story = {
  args: {
    columns: [
      {
        'aria-label': '시각',
        options: TIME_OPTIONS.slice(-2),
        value: '23:00',
        onChange: fn(),
      },
    ],
  },
};
