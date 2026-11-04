import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import waveBackgroundUrl from '@/assets/images/waveBackground.jpg';
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
  args: {
    floorSeed: { order: 1, id: 4101 },
    onOverflowClick: fn(),
  },
  argTypes: {
    items: {
      description:
        '코디의 아이템입니다. 바닥에 옷을 놓고, 아이템의 스타일 태그를 합쳐 많이 나온 순으로 2개를 아래에 보여 줍니다.',
      control: 'object',
    },
    floorSeed: {
      description:
        '바닥 배치를 고정하는 값입니다. order의 짝홀로 넓은 열의 좌우를 정하고, id의 해시로 나머지를 정합니다.',
      control: 'object',
    },
    isRegenerating: {
      description: '재추천을 만드는 동안 카드에 덮개를 씌웁니다.',
      control: 'boolean',
    },
    onOverflowClick: {
      description: '넘친 아이템의 수 버튼을 누를 때 호출합니다.',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ background: `url(${waveBackgroundUrl}) center / cover` }}>
        <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          <Story />
        </div>
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

export const Overflowing: Story = {
  args: {
    items: [
      createItem('outer'),
      createItem('top'),
      createItem('bottom'),
      createItem('shoes'),
      createItem('socks'),
      createItem('accessories', { accessory_type_cd: 'hat' }),
      createItem('accessories', { accessory_type_cd: 'bag' }),
      createItem('accessories', { accessory_type_cd: 'eyewear' }),
      createItem('accessories', { accessory_type_cd: 'belt' }),
      createItem('accessories', { accessory_type_cd: 'watch' }),
    ],
  },
};
