import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import Accordion from '@/components/common/Accordion';
import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import AccordionItem from './AccordionItem';

const SEASONS = ['봄', '여름', '가을', '겨울'];

const meta = {
  component: AccordionItem,
  argTypes: {
    value: {
      description:
        '묶음 안에서 행을 구분하는 값입니다. `Accordion`의 `value`와 같으면 펼쳐집니다.',
      control: 'text',
    },
    label: {
      description: '행 왼쪽에 보이는 항목 이름입니다.',
      control: 'text',
    },
    summary: {
      description:
        '행 오른쪽에 보이는 현재 값입니다. 글자면 넘칠 때 말줄임표로 줄이고, 색 점처럼 글자가 아닌 요소도 넘길 수 있습니다. 비어 있으면 `placeholder`를 흐리게 보여 줍니다.',
      control: 'text',
    },
    placeholder: {
      description: '값이 비어 있을 때 `summary` 자리에 보이는 안내 문구입니다.',
      control: 'text',
    },
    errorMessage: {
      description:
        '행 아래에 보이는 에러 문구입니다. 접혀 있으면 행 바로 아래, 펼쳐져 있으면 펼친 내용 아래에 나타나고 스크린리더가 곧바로 읽습니다.',
      control: 'text',
    },
    isDisabled: {
      description: '행을 누를 수 없게 하고 흐리게 보여 줍니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    children: {
      description: '행을 펼쳤을 때 아래에 보이는 내용입니다.',
      control: false,
    },
  },
  args: {
    value: 'season',
    label: '계절',
    summary: '가을',
    placeholder: '계절을 선택해 주세요',
    children: null,
  },
  render: (args) => (
    <Accordion>
      <AccordionItem {...args}>
        <ChipGroup
          aria-label={args.label}
          value="가을"
          onChange={fn()}
          isDeselectable
        >
          {SEASONS.map((season) => (
            <Chip key={season} value={season}>
              {season}
            </Chip>
          ))}
        </ChipGroup>
      </AccordionItem>
    </Accordion>
  ),
} satisfies Meta<typeof AccordionItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Opened: Story = {
  render: function Render(args) {
    const [openItem, setOpenItem] = useState<string | null>(args.value);

    return (
      <Accordion value={openItem} onValueChange={setOpenItem}>
        <AccordionItem {...args}>
          <ChipGroup
            aria-label={args.label}
            value="가을"
            onChange={fn()}
            isDeselectable
          >
            {SEASONS.map((season) => (
              <Chip key={season} value={season}>
                {season}
              </Chip>
            ))}
          </ChipGroup>
        </AccordionItem>
      </Accordion>
    );
  },
};

export const Empty: Story = {
  args: {
    summary: undefined,
  },
};

export const WithError: Story = {
  args: {
    errorMessage: '서버에 연결할 수 없습니다.',
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const LongSummary: Story = {
  args: {
    label: '스타일',
    summary: '미니멀, 캐주얼, 스트릿, 클래식, 포멀, 스포티, 로맨틱',
  },
};
