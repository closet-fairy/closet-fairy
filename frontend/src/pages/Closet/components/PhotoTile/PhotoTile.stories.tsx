import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import PhotoTile from './PhotoTile';

// 390px 화면의 2열 사진 확인 화면에서 한 칸의 폭이다.
const TILE_WIDTH = 164;

const meta = {
  component: PhotoTile,
  argTypes: {
    fileName: {
      description:
        '고른 사진의 파일 이름입니다. 누를 수 있는 이름이자, 미리보기를 못 그릴 때 대신 보여 줍니다.',
      control: 'text',
    },
    previewUrl: {
      description: '고른 사진의 미리보기 주소입니다.',
      control: 'text',
    },
    state: {
      description:
        '`selected`는 등록할 사진, `discarded`는 버린 사진, `locked`는 20장을 다 골라 더 고를 수 없는 사진입니다.',
      control: 'inline-radio',
      options: ['selected', 'discarded', 'locked'],
    },
    onToggle: {
      description: '사진을 누르면 알립니다. `locked`면 눌리지 않습니다.',
    },
  },
  args: {
    fileName: 'IMG_2077.JPG',
    previewUrl: '/media/clothing/1/sample_cutout.webp',
    state: 'selected',
    onToggle: fn(),
  },
  render: (args) => (
    <div style={{ width: TILE_WIDTH }}>
      <PhotoTile {...args} />
    </div>
  ),
} satisfies Meta<typeof PhotoTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selected: Story = {};

export const Discarded: Story = {
  args: { state: 'discarded' },
};

export const Locked: Story = {
  args: { state: 'locked' },
};

export const BrokenPreview: Story = {
  args: {
    fileName: 'IMG_2077.HEIC',
    previewUrl: '/media/clothing/1/missing.heic',
  },
};
