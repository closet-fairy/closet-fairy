import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { ClothingUpload } from '@/pages/Closet/clothingUploadStore';
import UploadCard from './UploadCard';

// 390px 화면의 3열 그리드에서 카드 한 칸의 폭이다.
const CARD_WIDTH = 112;

const UPLOADING: ClothingUpload = {
  id: 'upload-1',
  file: new File([], 'IMG_2077.JPG', { type: 'image/jpeg' }),
  previewUrl: '/media/clothing/1/sample.webp',
  status: 'uploading',
  errorMessage: null,
};

const meta = {
  component: UploadCard,
  argTypes: {
    upload: {
      description:
        '옷장에서 보내는 중이거나 보내지 못한 사진입니다. `status`가 `uploading`이면 처리 중 카드처럼, `failed`면 올리기 실패 카드로 그립니다.',
      control: 'object',
    },
    onResend: {
      description: '올리기 실패 카드의 [다시 보내기]를 누르면 알립니다.',
    },
    onDismiss: {
      description: '올리기 실패 카드 오른쪽 위의 ×를 누르면 알립니다.',
    },
  },
  args: {
    upload: UPLOADING,
    onResend: fn(),
    onDismiss: fn(),
  },
  render: (args) => (
    <div style={{ width: CARD_WIDTH }}>
      <UploadCard {...args} />
    </div>
  ),
} satisfies Meta<typeof UploadCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Uploading: Story = {};

export const BrokenPreview: Story = {
  args: {
    upload: {
      ...UPLOADING,
      file: new File([], 'IMG_2077.HEIC', { type: 'image/heic' }),
      previewUrl: '/media/clothing/1/missing.heic',
    },
  },
};

export const Failed: Story = {
  args: {
    upload: {
      ...UPLOADING,
      status: 'failed',
      errorMessage: '옷 등록 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    },
  },
};
