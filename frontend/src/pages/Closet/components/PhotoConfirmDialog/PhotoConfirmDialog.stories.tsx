import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { PickedPhoto } from '@/pages/Closet/types';
import PhotoConfirmDialog from './PhotoConfirmDialog';

const SAMPLE_PREVIEWS = [
  '/media/clothing/1/sample_cutout.webp',
  '/media/clothing/1/sample.webp',
  '/media/clothing/1/sample_display.webp',
];

const createPhotos = (count: number): PickedPhoto[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `photo-${index}`,
    file: new File([], `IMG_${2001 + index}.JPG`, { type: 'image/jpeg' }),
    previewUrl: SAMPLE_PREVIEWS[index % SAMPLE_PREVIEWS.length],
    rejectMessage: null,
  }));

const meta = {
  component: PhotoConfirmDialog,
  argTypes: {
    isOpen: {
      description: '사진 확인 화면을 띄울지 정합니다.',
      control: 'boolean',
    },
    photos: {
      description:
        '갤러리에서 고른 사진입니다. `rejectMessage`가 있는 사진은 형식·용량 때문에 제외해 배너로만 알립니다. 열 때마다 처음에는 앞의 20장을 고른 상태로 시작하므로, 새로 열 때는 `key`를 바꿔 다시 그립니다.',
      control: 'object',
    },
    onClose: {
      description:
        '헤더의 뒤로 가기를 누르면 알립니다. 받는 쪽은 아무것도 등록하지 않고 닫습니다.',
    },
    onSubmit: {
      description:
        '[N벌 등록하기]를 누르면 고른 사진을 넘깁니다. 받는 쪽은 곧바로 닫고 업로드를 시작합니다.',
    },
  },
  args: {
    isOpen: true,
    photos: createPhotos(4),
    onClose: fn(),
    onSubmit: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '700px' } },
  },
} satisfies Meta<typeof PhotoConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithExcluded: Story = {
  args: {
    photos: [
      ...createPhotos(3),
      {
        id: 'gif',
        file: new File([], 'IMG_1983.GIF', { type: 'image/gif' }),
        previewUrl: '',
        rejectMessage: 'JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요',
      },
      {
        id: 'heic',
        file: new File([], 'IMG_2077.HEIC', { type: 'image/heic' }),
        previewUrl: '/media/clothing/1/missing.heic',
        rejectMessage: null,
      },
    ],
  },
};

export const Full: Story = {
  args: {
    photos: createPhotos(24),
  },
};

export const NothingToRegister: Story = {
  args: {
    photos: [
      {
        id: 'gif',
        file: new File([], 'IMG_1983.GIF', { type: 'image/gif' }),
        previewUrl: '',
        rejectMessage: 'JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요',
      },
    ],
  },
};
