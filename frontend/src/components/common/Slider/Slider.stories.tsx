import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs, useState } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import Slider from './Slider';

const meta = {
  component: Slider,
  argTypes: {
    value: {
      description:
        '현재 값입니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: 'number',
    },
    onChange: {
      description:
        '끌거나 트랙을 누르거나 방향키로 값이 바뀔 때마다 호출합니다. 이벤트 객체가 아니라 새 값을 숫자로 넘깁니다.',
    },
    min: {
      description: '가장 작은 값입니다.',
      control: 'number',
    },
    max: {
      description: '가장 큰 값입니다.',
      control: 'number',
    },
    step: {
      description: '값이 움직이는 단위입니다. 방향키 한 번에 이만큼 바뀝니다.',
      control: 'number',
      table: { defaultValue: { summary: '1' } },
    },
    marks: {
      description:
        '표시할 값들입니다. 최솟값과 최댓값 사이의 값에는 트랙 위에 짧은 눈금을 그립니다. 양 끝은 트랙 끝과 겹쳐 눈금을 그리지 않습니다. `label`을 준 값은 트랙 아래에 글자로도 보여 주고, 양 끝 글자는 트랙 끝에 맞춰 안쪽으로 붙습니다.',
      control: 'object',
    },
    fillOrigin: {
      description:
        '트랙을 진하게 채우기 시작할 값입니다. 채움은 이 값과 현재 값 사이에 그려집니다. 기본은 최솟값이고, 가운데가 기준인 값(예: 기울기)은 0을 넘깁니다.',
      control: 'number',
      table: { defaultValue: { summary: 'min' } },
    },
    hasFill: {
      description: '트랙 채움을 그릴지 정합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
    isDisabled: {
      description: '조작할 수 없게 하고 흐리게 보여 줍니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onDraggingChange: {
      description:
        '손가락이나 마우스로 누르기 시작할 때 `true`, 뗄 때 `false`로 호출합니다. 잡는 동안만 보여 줄 표시(예: 붓 크기 원, 격자)에 씁니다. 방향키 조작에서는 호출하지 않습니다.',
    },
    getAriaValueText: {
      description:
        '스크린리더가 현재 값을 읽을 문장을 만듭니다. 넘기지 않으면 숫자만 읽습니다.',
      control: false,
    },
    'aria-label': {
      description:
        '스크린리더가 읽을 이름입니다. 화면에 보이는 라벨이 따로 있으면 이 대신 `aria-labelledby`를 씁니다. `FormField` 안에서는 그 라벨이 자동으로 이름이 됩니다.',
      control: 'text',
    },
    'aria-labelledby': {
      description:
        '이름으로 쓸 요소의 `id`입니다. 넘기면 자동 연결보다 우선합니다.',
      control: 'text',
    },
  },
  args: {
    value: 20,
    onChange: fn(),
    onDraggingChange: fn(),
    min: 4,
    max: 80,
    'aria-label': '붓 크기',
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: number) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return (
      <div style={{ width: 320 }}>
        <Slider {...args} onChange={handleChange} />
      </div>
    );
  },
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CenteredWithMarks: Story = {
  args: {
    value: -6,
    min: -45,
    max: 45,
    fillOrigin: 0,
    marks: [
      { value: -45, label: '−45°' },
      { value: 0, label: '0°' },
      { value: 45, label: '45°' },
    ],
    'aria-label': '기울기',
    getAriaValueText: (value: number) => `${value}도`,
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const DraggingIndicator: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    const [isDragging, setIsDragging] = useState(false);

    const handleChange = (value: number) => {
      args.onChange(value);
      updateArgs({ value });
    };

    const handleDraggingChange = (nextIsDragging: boolean) => {
      args.onDraggingChange?.(nextIsDragging);
      setIsDragging(nextIsDragging);
    };

    return (
      <div style={{ width: 320 }}>
        <Slider
          {...args}
          onChange={handleChange}
          onDraggingChange={handleDraggingChange}
        />
        <p>{isDragging ? '잡는 중' : '놓음'}</p>
      </div>
    );
  },
};
