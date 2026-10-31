import type { Meta, StoryObj } from '@storybook/react-vite';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitThumbnails from './OutfitThumbnails';

const THUMBNAILS_WIDTH = 322;

const createItem = (name: string) => ({
  item_name: name,
  image_url: cutoutUrl,
});

const meta = {
  component: OutfitThumbnails,
  args: {
    items: [createItem('상의'), createItem('하의'), createItem('신발')],
    hiddenCount: 0,
  },
  decorators: [
    (Story) => (
      <div style={{ width: THUMBNAILS_WIDTH }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OutfitThumbnails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHiddenCount: Story = {
  args: { hiddenCount: 3 },
};

export const NoImage: Story = {
  args: {
    items: [
      createItem('상의'),
      createItem('하의'),
      createItem('신발'),
      { item_name: '흰 양말', image_url: null },
    ],
  },
};

export const EssentialItem: Story = {
  args: {
    items: [
      createItem('상의'),
      {
        item_name: '흰 양말',
        item_source_cd: 'essential',
        image_url: null,
      },
    ],
  },
};
