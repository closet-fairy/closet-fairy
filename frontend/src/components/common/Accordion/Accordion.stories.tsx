import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import AccordionItem from '@/components/common/AccordionItem';
import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import Accordion from './Accordion';

const CATEGORIES = ['아우터', '상의', '하의', '신발', '양말', '악세서리'];
const THICKNESSES = ['얇음', '보통', '두꺼움'];

const meta = {
  component: Accordion,
  argTypes: {
    children: {
      description:
        '`AccordionItem` 행들입니다. 한 번에 한 행만 펼쳐지고, 다른 행을 누르면 열려 있던 행은 접힙니다.',
      control: false,
    },
    value: {
      description:
        '펼쳐진 행의 `value`입니다. 넘기지 않으면 펼침 상태를 내부에서 관리하고, `null`이면 모두 접힙니다.',
      control: 'text',
    },
    onValueChange: {
      description:
        '행을 펼치거나 접을 때 펼쳐진 행의 `value`(모두 접히면 `null`)를 받아 호출합니다.',
    },
  },
  args: {
    children: null,
    onValueChange: fn(),
  },
  render: function Render(args) {
    const [category, setCategory] = useState<string | null>('상의');
    const [thickness, setThickness] = useState<string | null>(null);
    const [openItem, setOpenItem] = useState(args.value ?? null);

    const handleValueChange = (value: string | null) => {
      setOpenItem(value);
      args.onValueChange?.(value);
    };

    return (
      <Accordion value={openItem} onValueChange={handleValueChange}>
        <AccordionItem
          value="category"
          label="분류"
          summary={category}
          placeholder="분류를 선택해 주세요"
        >
          <ChipGroup
            aria-label="분류"
            value={category}
            onChange={setCategory}
            isDeselectable
          >
            {CATEGORIES.map((item) => (
              <Chip key={item} value={item}>
                {item}
              </Chip>
            ))}
          </ChipGroup>
        </AccordionItem>
        <AccordionItem
          value="thickness"
          label="두께"
          summary={thickness}
          placeholder="두께를 선택해 주세요"
        >
          <ChipGroup
            aria-label="두께"
            value={thickness}
            onChange={setThickness}
            isDeselectable
          >
            {THICKNESSES.map((item) => (
              <Chip key={item} value={item}>
                {item}
              </Chip>
            ))}
          </ChipGroup>
        </AccordionItem>
      </Accordion>
    );
  },
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Opened: Story = {
  args: {
    value: 'category',
  },
};
