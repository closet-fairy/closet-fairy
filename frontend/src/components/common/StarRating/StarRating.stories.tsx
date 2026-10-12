import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import StarRating from './StarRating';

const meta = {
  component: StarRating,
  argTypes: {
    value: {
      description:
        '현재 별점입니다. 0이면 아무 별도 채우지 않습니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: { type: 'range', min: 0, max: 5, step: 1 },
    },
    onChange: {
      description:
        '별을 눌러 별점이 바뀔 때 호출합니다. 이벤트 객체가 아니라 새 별점(1~5)을 숫자로 넘깁니다. 이미 고른 별을 다시 눌러도 해제되지 않습니다. 입력 모드에서는 반드시 넘기고, 읽기 전용에서는 넘길 수 없습니다.',
    },
    isReadOnly: {
      description:
        '누를 수 없는 표시 전용으로 그립니다. 스크린리더에는 "별점 5점 중 4점"처럼 하나의 이미지로 읽힙니다. `size`가 sm이면 반드시 true로 넘깁니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    isDisabled: {
      description:
        '입력 모드에서 모든 별을 누를 수 없게 하고 흐리게 표시합니다. 읽기 전용에서는 넘길 수 없습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    'aria-label': {
      description:
        '스크린리더가 읽을 이름입니다. 화면에는 보이지 않습니다. 입력 모드에서는 별 묶음의 이름이 되어 "이 코디, 얼마나 마음에 드세요" 같은 질문도 자연스럽습니다. 읽기 전용에서는 "<aria-label> 5점 중 n점"의 앞부분이 되므로 "별점", "코디 만족도"처럼 명사로 적습니다.',
      control: 'text',
      table: { defaultValue: { summary: '별점' } },
    },
    size: {
      description:
        '크기입니다. md는 36px 별 다섯 개, sm은 "★ 4"처럼 작은 글자 형태입니다. sm은 읽기 전용(`isReadOnly`)일 때만 쓸 수 있습니다.',
      control: 'inline-radio',
      options: ['md', 'sm'],
      table: { defaultValue: { summary: 'md' } },
    },
  },
  args: {
    value: 0,
    onChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    if (args.isReadOnly) {
      return <StarRating {...args} />;
    }

    const handleChange = (value: number) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return <StarRating {...args} onChange={handleChange} />;
  },
} satisfies Meta<typeof StarRating>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    value: 3,
  },
};

export const Disabled: Story = {
  args: {
    value: 3,
    isDisabled: true,
  },
};

export const ReadOnly: Story = {
  args: {
    value: 4,
    isReadOnly: true,
  },
};

export const Sizes: Story = {
  args: {
    value: 4,
  },
  render: (args) => (
    <StoryStack gap={24}>
      <StoryLabeled label="md">
        <StarRating value={args.value} size="md" isReadOnly />
      </StoryLabeled>
      <StoryLabeled label="sm">
        <StarRating value={args.value} size="sm" isReadOnly />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const RatingModalExample: Story = {
  args: {
    value: 4,
    'aria-label': '이 코디, 얼마나 마음에 드세요',
  },
};

export const AdoptedSummaryExample: Story = {
  args: {
    value: 4,
    size: 'sm',
    isReadOnly: true,
    'aria-label': '코디 만족도',
  },
};
