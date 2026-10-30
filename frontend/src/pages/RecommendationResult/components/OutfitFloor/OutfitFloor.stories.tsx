import type { Meta, StoryObj } from '@storybook/react-vite';
import type { OutfitItemResult } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitFloor from './OutfitFloor';

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
  style_cds: [],
  ...overrides,
});

const HAT = createItem('accessories', { accessory_type_cd: 'hat' });

const meta = {
  component: OutfitFloor,
  argTypes: {
    items: {
      description:
        '코디의 아이템입니다. 모자, 상의, 하의, 신발만 놓고 에센셜과 이미지가 없는 아이템은 뺍니다. 놓을 옷이 없으면 미리보기 미지원 안내를 보여 줍니다.',
      control: 'object',
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          overflow: 'hidden',
          containerType: 'size',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OutfitFloor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes'), HAT],
  },
};

export const WithoutHat: Story = {
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes')],
  },
};

export const WithEssential: Story = {
  args: {
    items: [
      createItem('top'),
      createItem('bottom', { item_source_cd: 'essential', image_url: null }),
      createItem('shoes'),
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
