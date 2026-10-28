import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent, within } from 'storybook/test';
import type { PickedPhoto } from '@/pages/Closet/types';
import CameraCaptureDialog from './CameraCaptureDialog';

const PHOTO: PickedPhoto = {
  id: 'capture-1',
  file: new File([], 'IMG_3001.JPG', { type: 'image/jpeg' }),
  previewUrl: '/media/clothing/1/sample.webp',
  rejectMessage: null,
};

const meta = {
  component: CameraCaptureDialog,
  argTypes: {
    isOpen: {
      description: '촬영 미리보기를 띄울지 정합니다.',
      control: 'boolean',
    },
    photo: {
      description:
        '카메라로 찍은 사진입니다. 사진마다 답을 새로 받으므로 새 사진이 오면 `key`를 바꿔 다시 그립니다.',
      control: 'object',
    },
    onRegister: {
      description:
        '[등록]을 누르면 알립니다. 받는 쪽은 그 사진 한 장을 바로 보냅니다.',
    },
    onContinue: {
      description:
        '[등록]이나 [버리기]로 답한 뒤 [계속 촬영]을 누르면 알립니다. 받는 쪽은 카메라를 다시 엽니다.',
    },
    onFinish: {
      description:
        '[촬영 종료]나 헤더의 닫기를 누르면 알립니다. 답하지 않은 사진은 버리고 닫습니다.',
    },
  },
  args: {
    isOpen: true,
    photo: PHOTO,
    onRegister: fn(),
    onContinue: fn(),
    onFinish: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '720px' } },
  },
} satisfies Meta<typeof CameraCaptureDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BrokenPreview: Story = {
  args: {
    photo: {
      ...PHOTO,
      file: new File([], 'IMG_3001.HEIC', { type: 'image/heic' }),
      previewUrl: '/media/clothing/1/missing.heic',
    },
  },
};

export const Rejected: Story = {
  args: {
    photo: {
      ...PHOTO,
      rejectMessage: '20MB 이하 사진만 올릴 수 있어요',
    },
  },
};

export const Answered: Story = {
  play: async () => {
    await userEvent.click(
      await within(document.body).findByRole('button', { name: '버리기' }),
    );
  },
};
