import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import type {
  GenderCd,
  TemperatureSensitivityCd,
} from '@/domains/member/memberSettingOptions';
import BodyTypeFields from './BodyTypeFields';

const meta = {
  component: BodyTypeFields,
  argTypes: {
    temperatureSensitivity: {
      description:
        '고른 체질 코드입니다. 고르지 않았으면 `null`입니다. 고른 칩을 다시 누르면 `null`로 풀립니다.',
      control: 'inline-radio',
      options: [null, 'cold_sensitive', 'normal', 'heat_sensitive'],
    },
    gender: {
      description:
        '고른 성별 코드입니다. 고르지 않았으면 `null`입니다. `isGenderDeselectable`이면 고른 칩을 다시 눌러 `null`로 풀 수 있습니다.',
      control: 'inline-radio',
      options: [null, 'male', 'female', 'unisex'],
    },
    onTemperatureSensitivityChange: {
      description: '체질을 고르거나 풀 때 알립니다.',
    },
    onGenderChange: {
      description: '성별을 고르거나 풀 때 알립니다.',
    },
    isGenderDeselectable: {
      description:
        '성별 칩을 다시 눌러 풀 수 있게 할지 정합니다. 온보딩처럼 아직 고르지 않은 상태가 있는 곳에서 씁니다. 프로필 수정처럼 BE가 늘 값을 갖고 있는 곳(비우면 unisex로 저장)에서는 `false`로 둡니다. 체질은 비워 둘 수 있어 늘 풀 수 있습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
    isDisabled: {
      description: '저장 중처럼 고칠 수 없을 때 모든 칩을 막습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    temperatureSensitivity: 'cold_sensitive',
    gender: null,
    onTemperatureSensitivityChange: fn(),
    onGenderChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleTemperatureChange = (
      value: TemperatureSensitivityCd | null,
    ) => {
      args.onTemperatureSensitivityChange(value);
      updateArgs({ temperatureSensitivity: value });
    };

    const handleGenderChange = (value: GenderCd | null) => {
      args.onGenderChange(value);
      updateArgs({ gender: value });
    };

    return (
      <BodyTypeFields
        {...args}
        onTemperatureSensitivityChange={handleTemperatureChange}
        onGenderChange={handleGenderChange}
      />
    );
  },
} satisfies Meta<typeof BodyTypeFields>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSelection: Story = {
  args: {
    temperatureSensitivity: null,
    gender: null,
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};
