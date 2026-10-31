import type { Meta, StoryObj } from '@storybook/react-vite';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitItemImage from './OutfitItemImage';

const CELL_WIDTH = 80;

const meta = {
  component: OutfitItemImage,
  argTypes: {
    item: {
      description:
        '코디 아이템입니다. 이미지가 없으면 점선 칸에 이름을 보여 주고, 불러오지 못하면 실선 칸에 사진 아이콘을 보여 줍니다.',
      control: 'object',
    },
    size: {
      description:
        'md는 정보 서랍의 격자 칸이고 에센셜에 [기본] 표시를 붙입니다. sm은 채택 완료의 썸네일 칸입니다.',
      control: 'inline-radio',
      options: ['md', 'sm'],
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
    (Story) => (
      <div style={{ width: CELL_WIDTH }}>
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
