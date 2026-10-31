import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
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

const OutfitStackStory = (props: {
  previousCount: number;
  isRegenerating?: boolean;
}) => {
  const { previousCount, isRegenerating } = props;
  const [depth, setDepth] = useState(0);

  return (
    <OutfitStack
      outfit={createOutfit(previousCount)}
      depth={depth}
      isRegenerating={isRegenerating}
      onDepthChange={setDepth}
    />
  );
};

const meta = {
  component: OutfitStackStory,
  argTypes: {
    previousCount: {
      description:
        '쌓인 이전 코디의 수입니다. 카드를 아래로 끌면 이전 코디로, 위로 끌면 최신 쪽으로 한 장씩 움직입니다.',
      control: 'number',
    },
    isRegenerating: {
      description: '재추천을 만드는 동안에는 덮개를 씌우고 끌 수 없게 합니다.',
      control: 'boolean',
    },
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
} satisfies Meta<typeof OutfitStackStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoHistory: Story = {
  args: { previousCount: 0 },
};

export const OnePrevious: Story = {
  args: { previousCount: 1 },
};

export const ManyPrevious: Story = {
  args: { previousCount: 3 },
};

export const Regenerating: Story = {
  args: { previousCount: 1, isRegenerating: true },
};
