import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RecommendationHistoryOutfitItem } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import HistoryItemGrid from './HistoryItemGrid';

const GRID_WIDTH = 350;

const createItem = (
  slotCd: RecommendationHistoryOutfitItem['slot_cd'],
  itemName: string,
  overrides: Partial<RecommendationHistoryOutfitItem> = {},
): RecommendationHistoryOutfitItem => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: itemName,
  image_url: cutoutUrl,
  style_cds: [],
  is_clothing_deleted: false,
  ...overrides,
});

const meta = {
  component: HistoryItemGrid,
  args: {
    items: [
      createItem('top', '베이지 터틀넥'),
      createItem('bottom', '그레이 슬랙스'),
      createItem('shoes', '브라운 스니커즈'),
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ width: GRID_WIDTH }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HistoryItemGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DeletedItem: Story = {
  args: {
    items: [
      createItem('top', '베이지 터틀넥'),
      createItem('bottom', '그레이 슬랙스', { is_clothing_deleted: true }),
    ],
  },
};

export const EssentialItems: Story = {
  args: {
    items: [
      createItem('socks', '흰 양말', { item_source_cd: 'essential' }),
      createItem('accessories', '은 목걸이', {
        item_source_cd: 'essential',
        image_url: null,
      }),
    ],
  },
};

export const EightItems: Story = {
  args: {
    items: [
      createItem('outer', '오트밀 가디건'),
      createItem('top', '베이지 터틀넥'),
      createItem('bottom', '그레이 슬랙스'),
      createItem('shoes', '브라운 스니커즈'),
      createItem('socks', '흰 양말', { item_source_cd: 'essential' }),
      createItem('accessories', '네이비 볼캡'),
      createItem('accessories', '가죽 벨트'),
      createItem('accessories', '은 목걸이', {
        item_source_cd: 'essential',
        image_url: null,
      }),
    ],
  },
};
