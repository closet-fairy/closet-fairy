import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RecommendationHistoryDetail } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import AdoptedOutfitCard from './AdoptedOutfitCard';

type Item = RecommendationHistoryDetail['outfit']['items'][number];

const CARD_WIDTH = 330;

const createItem = (
  slotCd: Item['slot_cd'],
  overrides: Partial<Item> = {},
): Item => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: slotCd,
  image_url: cutoutUrl,
  style_cds: [],
  is_clothing_deleted: false,
  ...overrides,
});

const ESSENTIAL_SOCKS = createItem('socks', {
  item_name: '흰 양말',
  item_source_cd: 'essential',
  image_url: null,
});

const meta = {
  component: AdoptedOutfitCard,
  argTypes: {
    items: {
      description:
        '채택한 코디의 아이템입니다. 머리에서 발 순서로 왼쪽에 채우고, 5개 이상이면 3칸과 남은 개수를 보여 줍니다.',
      control: 'object',
    },
    summary: { description: '날짜, 상황, 날씨를 이은 문구입니다.' },
    rating: { description: '매긴 별점입니다.' },
  },
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes')],
    summary: '8월 23일 · 데일리 · 24° 흐림',
    rating: 4,
  },
  decorators: [
    (Story) => (
      <div style={{ width: CARD_WIDTH }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdoptedOutfitCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeItems: Story = {};

export const WithEssential: Story = {
  args: {
    items: [
      createItem('top'),
      createItem('bottom'),
      createItem('shoes'),
      ESSENTIAL_SOCKS,
    ],
  },
};

export const ManyItems: Story = {
  args: {
    items: [
      createItem('outer'),
      createItem('top'),
      createItem('bottom'),
      createItem('shoes'),
      ESSENTIAL_SOCKS,
      createItem('accessories', { accessory_type_cd: 'hat' }),
      createItem('accessories', { accessory_type_cd: 'bag' }),
    ],
  },
};
