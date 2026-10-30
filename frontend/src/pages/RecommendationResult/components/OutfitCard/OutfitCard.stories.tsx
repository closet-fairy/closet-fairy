import type { Meta, StoryObj } from '@storybook/react-vite';
import type { OutfitItemResult } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitCard from './OutfitCard';

const CARD_WIDTH = 362;
const CARD_HEIGHT = 568;

const createItem = (
  slotCd: OutfitItemResult['slot_cd'],
  overrides: Partial<OutfitItemResult> = {},
): OutfitItemResult => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: slotCd,
  image_url: cutoutUrl,
  style_cds: ['minimal', 'casual'],
  ...overrides,
});

const meta = {
  component: OutfitCard,
  argTypes: {
    items: {
      description:
        '코디의 아이템입니다. 바닥에 옷을 놓고, 아이템의 스타일 태그를 합쳐 많이 나온 순으로 2개를 아래에 보여 줍니다.',
      control: 'object',
    },
    isRegenerating: {
      description: '재추천을 만드는 동안 카드에 덮개를 씌웁니다.',
      control: 'boolean',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OutfitCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes')],
  },
};

export const Regenerating: Story = {
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes')],
    isRegenerating: true,
  },
};

export const WithoutStyleTags: Story = {
  args: {
    items: [
      createItem('top', { style_cds: [] }),
      createItem('bottom', { style_cds: [] }),
      createItem('shoes', { style_cds: [] }),
    ],
  },
};

export const NothingToPlace: Story = {
  args: {
    items: [
      createItem('top', { item_source_cd: 'essential', image_url: null }),
      createItem('bottom', { item_source_cd: 'essential', image_url: null }),
      createItem('shoes', { item_source_cd: 'essential', image_url: null }),
    ],
  },
};
