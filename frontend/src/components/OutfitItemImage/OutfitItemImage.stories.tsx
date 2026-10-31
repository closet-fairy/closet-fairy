import type { Meta, StoryObj } from '@storybook/react-vite';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitItemImage from './OutfitItemImage';

const CELL_WIDTH = 80;
const LARGE_CELL_WIDTH = 110;

const meta = {
  component: OutfitItemImage,
  argTypes: {
    item: {
      description:
        '코디 아이템입니다. 기본 아이템은 이미지가 있어도 점선 칸입니다. 이미지가 없으면 칸에 이름을 보여 주고, 불러오지 못하면 사진 아이콘을 보여 줍니다.',
      control: 'object',
    },
    size: {
      description:
        'lg는 추천 내역 상세의 정사각형 칸이고, md는 정보 서랍의 격자 칸입니다. 둘 다 에센셜에 [기본] 표시를 붙입니다. sm은 썸네일 칸입니다.',
      control: 'inline-radio',
      options: ['lg', 'md', 'sm'],
    },
    isDeleted: {
      description:
        '추천 뒤에 지운 옷입니다. 사진을 흐리게 하고 [지운 옷] 표시를 붙입니다.',
      control: 'boolean',
    },
  },
  args: {
    item: {
      item_name: '베이지 터틀넥',
      item_source_cd: 'owned',
      image_url: cutoutUrl,
    },
  },
  decorators: [
    (Story, { args }) => (
      <div
        style={{ width: args.size === 'lg' ? LARGE_CELL_WIDTH : CELL_WIDTH }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OutfitItemImage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Thumbnail: Story = {
  args: { size: 'sm' },
};

export const EssentialWithImage: Story = {
  args: {
    item: {
      item_name: '흰 양말',
      item_source_cd: 'essential',
      image_url: cutoutUrl,
    },
  },
};

export const OwnedWithoutImage: Story = {
  args: {
    item: {
      item_name: '베이지 터틀넥',
      item_source_cd: 'owned',
      image_url: null,
    },
  },
};

export const LoadFailed: Story = {
  args: {
    item: {
      item_name: '베이지 터틀넥',
      item_source_cd: 'owned',
      image_url: '/image-not-found.webp',
    },
  },
};

export const Essential: Story = {
  args: {
    item: {
      item_name: '흰 양말',
      item_source_cd: 'essential',
      image_url: null,
    },
  },
};

export const EssentialThumbnail: Story = {
  args: { ...Essential.args, size: 'sm' },
};

export const Large: Story = {
  args: { size: 'lg' },
};

export const Deleted: Story = {
  args: { size: 'lg', isDeleted: true },
};

export const LargeEssential: Story = {
  args: {
    size: 'lg',
    item: {
      item_name: '흰 양말',
      item_source_cd: 'essential',
      image_url: null,
    },
  },
};
