import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs, useState } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import Chip from '@/components/common/Chip';
import ChipGroup from './ChipGroup';

const SITUATIONS = ['데일리', '출근', '데이트', '운동', '결혼식 하객', '면접'];

const CUSTOM_SITUATIONS = ['학교 발표', '동아리 MT', '친구 생일 파티'];

const SITUATION_CHIPS = (
  <>
    {SITUATIONS.map((situation) => (
      <Chip key={situation} value={situation}>
        {situation}
      </Chip>
    ))}
    <Chip value="custom" variant="dashed" trailingIcon="edit">
      직접 입력
    </Chip>
  </>
);

const meta = {
  component: ChipGroup,
  argTypes: {
    value: {
      description:
        '선택된 칩의 `value`입니다. 아무것도 고르지 않았으면 `null`입니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: 'select',
      options: [null, ...SITUATIONS, 'custom'],
    },
    onChange: {
      description:
        '다른 칩을 눌러 선택이 바뀔 때 호출합니다. 이벤트 객체가 아니라 새로 고른 칩의 `value` 문자열을 넘깁니다. 이미 선택된 칩을 다시 누르면 해제되지 않고 호출되지도 않으며, `onClick`을 넘긴 칩을 눌렀을 때도 호출되지 않습니다.',
    },
    children: {
      description: '묶을 `Chip`들입니다.',
      control: false,
    },
    'aria-label': {
      description:
        '스크린리더가 읽을 묶음 이름입니다. 화면에 보이는 제목이 따로 있으면 이 대신 `aria-labelledby`를 씁니다.',
      control: 'text',
    },
    'aria-labelledby': {
      description:
        '묶음 이름으로 쓸 요소의 `id`입니다. `FormField` 안에서는 그 라벨이 자동으로 이름이 되고 안내 문구가 설명으로 연결되므로 넘기지 않아도 됩니다. 넘기면 자동 연결보다 우선합니다.',
      control: 'text',
    },
    isDisabled: {
      description:
        '묶음 안 모든 칩을 누를 수 없게 하고 흐리게 보여 줍니다. 칩 하나만 막으려면 `Chip`의 `isDisabled`를 씁니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    value: '데일리',
    onChange: fn(),
    'aria-label': '상황',
    children: SITUATION_CHIPS,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: string) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return <ChipGroup {...args} onChange={handleChange} />;
  },
} satisfies Meta<typeof ChipGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSelection: Story = {
  args: {
    value: null,
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const PartiallyDisabled: Story = {
  args: {
    children: (
      <>
        <Chip value="데일리">데일리</Chip>
        <Chip value="출근" isDisabled>
          출근
        </Chip>
        <Chip value="데이트">데이트</Chip>
      </>
    ),
  },
};

export const CustomSituationSelected: Story = {
  args: {
    value: 'custom',
    children: (
      <>
        {SITUATIONS.map((situation) => (
          <Chip key={situation} value={situation}>
            {situation}
          </Chip>
        ))}
        <Chip value="custom" variant="dashed" trailingIcon="edit">
          학교 발표
        </Chip>
      </>
    ),
  },
};

export const CustomSituationInput: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    const [customSituation, setCustomSituation] = useState<string | null>(null);

    const handleChange = (value: string) => {
      args.onChange(value);
      updateArgs({ value });
    };

    const handleCustomChipClick = () => {
      const nextIndex =
        (CUSTOM_SITUATIONS.indexOf(customSituation ?? '') + 1) %
        CUSTOM_SITUATIONS.length;

      setCustomSituation(CUSTOM_SITUATIONS.at(nextIndex) ?? null);
      updateArgs({ value: 'custom' });
    };

    return (
      <ChipGroup {...args} onChange={handleChange}>
        {SITUATIONS.map((situation) => (
          <Chip key={situation} value={situation}>
            {situation}
          </Chip>
        ))}
        <Chip
          value="custom"
          variant="dashed"
          trailingIcon="edit"
          onClick={handleCustomChipClick}
        >
          {customSituation ?? '직접 입력'}
        </Chip>
      </ChipGroup>
    );
  },
};
