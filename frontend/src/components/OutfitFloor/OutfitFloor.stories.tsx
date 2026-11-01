import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { OutfitItemResult } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitFloor from './OutfitFloor';

const CARD_WIDTH = 362;
const CARD_HEIGHT = 568;
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 746;

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

const MANY_ITEMS = [
  HAT,
  createItem('accessories', { accessory_type_cd: 'eyewear' }),
  createItem('outer'),
  createItem('top'),
  createItem('accessories', { accessory_type_cd: 'bag' }),
  createItem('bottom'),
  createItem('socks'),
  createItem('shoes'),
  createItem('accessories', { accessory_type_cd: 'belt' }),
  createItem('accessories', { accessory_type_cd: 'watch' }),
  createItem('accessories', { accessory_type_cd: 'jewelry' }),
];

const meta = {
  component: OutfitFloor,
  argTypes: {
    variant: {
      description:
        'card는 결과 카드 안에 그립니다. floor는 카드 없이 바닥 위에 바로 그리고, 배치 영역을 남는 공간의 가운데에 둡니다.',
      control: 'inline-radio',
      options: ['card', 'floor'],
      table: { defaultValue: { summary: 'card' } },
    },
    items: {
      description:
        '코디의 아이템입니다. 사진이 있는 옷을 사진 결과가 정해진 뒤 한 번에 놓습니다. 놓을 옷이 없으면 전부 이미지가 없을 때와 사진을 불러오지 못했을 때를 나눠 안내합니다.',
      control: 'object',
    },
    seed: {
      description:
        '배치를 고정하는 값입니다. order의 짝홀로 넓은 열의 좌우를 정하고, id의 해시로 나머지를 정합니다.',
      control: 'object',
    },
    hasTagStrip: {
      description:
        '카드 아래 태그 띠가 있는지 나타냅니다. 없으면 비워 둔 자리의 절반만큼 배치를 내려 세로 가운데를 맞춥니다.',
      control: 'boolean',
    },
    isOverflowDisabled: {
      description: '넘친 아이템의 수 버튼을 비활성으로 둡니다.',
      control: 'boolean',
    },
    onOverflowClick: {
      description:
        '넘친 아이템의 수 버튼을 누를 때 호출합니다. 없으면 버튼을 그리지 않습니다.',
    },
    entrance: {
      description:
        '옷이 위에서 내려앉으며 나타나는 등장 애니메이션입니다. 없으면 바로 보여 줍니다. 사진 결과가 정해지고 isActive가 true가 되면 시작하고, 시작하는 순간 onPlay를 호출합니다. 움직임 줄이기 설정이면 재생하지 않습니다.',
      control: 'object',
    },
  },
  args: {
    seed: { order: 1, id: 4101 },
    onOverflowClick: fn(),
  },
  decorators: [
    (Story, { args }) => (
      <div
        style={{
          position: 'relative',
          width: args.variant === 'floor' ? SCREEN_WIDTH : CARD_WIDTH,
          height: args.variant === 'floor' ? SCREEN_HEIGHT : CARD_HEIGHT,
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

export const Overflowing: Story = {
  args: { items: MANY_ITEMS },
};

export const OverflowDisabled: Story = {
  args: { items: MANY_ITEMS, isOverflowDisabled: true },
};

export const EvenOrder: Story = {
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes')],
    seed: { order: 2, id: 4102 },
  },
};

export const WithoutTagStrip: Story = {
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes')],
    hasTagStrip: false,
  },
};

export const LoadFailed: Story = {
  args: {
    items: [
      createItem('top', { image_url: '/image-not-found.webp' }),
      createItem('bottom', { image_url: '/image-not-found.webp' }),
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

export const OnFloor: Story = {
  args: { items: MANY_ITEMS, variant: 'floor' },
};

export const WithEntrance: Story = {
  args: {
    items: MANY_ITEMS,
    entrance: { isActive: true },
  },
};

export const WaitingForEntrance: Story = {
  args: {
    items: [createItem('top'), createItem('bottom'), createItem('shoes'), HAT],
    entrance: { isActive: false },
  },
};
