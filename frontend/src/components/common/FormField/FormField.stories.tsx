import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import StoryStack from '../../../../.storybook/StoryStack';
import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import Icon from '@/components/common/Icon';
import Picker from '@/components/common/Picker';
import TextField from '@/components/common/TextField';
import FormField from './FormField';

const SITUATIONS = ['데일리', '출근', '데이트'];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  const time = `${hours}:${minutes}`;

  return { value: time, label: time };
});

const meta = {
  component: FormField,
  argTypes: {
    label: {
      description: '항목 위에 보이는 라벨입니다.',
      control: 'text',
    },
    hint: {
      description:
        '라벨 오른쪽에 붙는 짧은 안내입니다. 안쪽의 `ChipGroup`, `Picker`는 이 문구를 자동으로 설명으로 연결합니다.',
      control: 'text',
    },
    htmlFor: {
      description:
        '라벨과 연결할 입력 요소의 id입니다. 넘기면 라벨을 `<label for>`로 그려 라벨을 눌렀을 때 그 요소로 포커스가 갑니다. `ChipGroup`, `Picker`처럼 입력 요소가 아닌 공용 컴포넌트는 넘기지 않아도 라벨과 안내가 자동으로 연결됩니다.',
      control: 'text',
    },
    children: {
      description:
        '라벨 아래에 놓을 내용입니다. 안쪽의 `ChipGroup`, `Picker`는 라벨을 이름으로, 안내를 설명으로 자동으로 씁니다. 그 밖의 요소는 `htmlFor`로 연결합니다.',
      control: false,
    },
  },
  args: {
    label: '상황',
    htmlFor: 'form-field-input',
    children: null,
  },
  render: function Render(args) {
    const [value, setValue] = useState('');

    if (args.htmlFor === undefined) {
      return <FormField {...args} />;
    }

    return (
      <FormField {...args}>
        <TextField
          id={args.htmlFor}
          value={value}
          onChange={setValue}
          placeholder="예: 학교 발표"
          maxLength={100}
        />
      </FormField>
    );
  },
} satisfies Meta<typeof FormField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: {
    hint: '최대 100자',
  },
};

export const OutingTimeExample: Story = {
  args: {
    label: '외출 시간',
    hint: '30분 단위',
    htmlFor: undefined,
  },
  render: function Render(args) {
    const [startTime, setStartTime] = useState<string | null>('09:00');
    const [endTime, setEndTime] = useState<string | null>('14:00');

    return (
      <FormField {...args}>
        <StoryStack gap={10}>
          <Picker
            label="나가는 시간"
            options={TIME_OPTIONS}
            value={startTime}
            onChange={setStartTime}
          />
          <Icon name="arrow_forward" size="sm" />
          <Picker
            label="돌아오는 시간"
            options={TIME_OPTIONS}
            value={endTime}
            onChange={setEndTime}
          />
        </StoryStack>
      </FormField>
    );
  },
};

export const LongText: Story = {
  args: {
    label:
      '라벨이 아주 길어져서 한 줄에 다 들어가지 않을 때 안내 문구와 겹치지 않고 줄을 바꾸는지 확인하는 라벨',
    hint: '하나만 선택',
  },
};

export const SituationExample: Story = {
  args: {
    label: '상황',
    hint: '하나만 선택',
    htmlFor: undefined,
  },
  render: function Render(args) {
    const [situation, setSituation] = useState<string | null>('데일리');

    return (
      <FormField {...args}>
        <ChipGroup value={situation} onChange={setSituation}>
          {SITUATIONS.map((item) => (
            <Chip key={item} value={item}>
              {item}
            </Chip>
          ))}
          <Chip value="custom" variant="dashed" trailingIcon="edit">
            직접 입력
          </Chip>
        </ChipGroup>
      </FormField>
    );
  },
};
