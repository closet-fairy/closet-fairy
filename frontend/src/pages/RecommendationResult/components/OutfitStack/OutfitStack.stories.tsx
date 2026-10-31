import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import type { OutfitItemResult, OutfitResult } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitStack from './OutfitStack';

const CARD_WIDTH = 362;
const CARD_HEIGHT = 568;
const STRIP_SPACE = 14;

const createItem = (slotCd: OutfitItemResult['slot_cd']): OutfitItemResult => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: slotCd,
  image_url: cutoutUrl,
  style_cds: ['minimal', 'casual'],
});

const createPreviousOutfit = (outfitId: number) => ({
  outfit_id: outfitId,
  outfit_seq: 1,
  outfit_type_cd: 'preferred' as const,
  reason: null,
  items: [createItem('top'), createItem('shoes')],
});

const createOutfit = (previousCount: number): OutfitResult => ({
  ...createPreviousOutfit(100),
  items: [createItem('top'), createItem('bottom'), createItem('shoes')],
  previous_outfits: Array.from({ length: previousCount }, (_, index) =>
    createPreviousOutfit(index + 1),
  ),
});

const meta = {
  component: OutfitStack,
  argTypes: {
    outfit: {
      description:
        '세트의 최신 코디입니다. `previous_outfits`에 든 이전 코디가 그 뒤에 쌓입니다.',
      control: 'object',
    },
    depth: {
      description:
        '지금 보는 겹입니다. 0이 최신 코디이고, 커질수록 이전 코디입니다. 카드를 아래로 끌면 커지고 위로 끌면 작아집니다.',
      control: 'number',
    },
    isRegenerating: {
      description: '재추천을 만드는 동안에는 덮개를 씌우고 끌 수 없게 합니다.',
      control: 'boolean',
    },
    onDepthChange: {
      description:
        '끌기나 숨은 이동 버튼으로 다른 겹으로 넘어갈 때 새 깊이로 호출됩니다.',
    },
    onOverflowClick: {
      description: '넘친 아이템의 수 버튼을 누를 때 호출합니다.',
    },
  },
  args: {
    outfit: createOutfit(0),
    depth: 0,
    onDepthChange: fn(),
    onOverflowClick: fn(),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          marginTop: STRIP_SPACE,
        }}
      >
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleDepthChange = (depth: number) => {
      args.onDepthChange(depth);
      updateArgs({ depth });
    };

    return <OutfitStack {...args} onDepthChange={handleDepthChange} />;
  },
} satisfies Meta<typeof OutfitStack>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoHistory: Story = {};

export const OnePrevious: Story = {
  args: { outfit: createOutfit(1) },
};

export const ManyPrevious: Story = {
  args: { outfit: createOutfit(3) },
};

export const ViewingPrevious: Story = {
  args: { outfit: createOutfit(3), depth: 1 },
};

export const Regenerating: Story = {
  args: { outfit: createOutfit(1), isRegenerating: true },
};
