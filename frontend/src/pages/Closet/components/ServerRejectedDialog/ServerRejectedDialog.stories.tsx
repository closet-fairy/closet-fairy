import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ServerRejectedDialog from './ServerRejectedDialog';

const meta = {
  component: ServerRejectedDialog,
  argTypes: {
    photos: {
      description:
        '업로드가 끝난 뒤 서버가 제외한 사진입니다. 한 장이라도 있으면 다이얼로그를 띄우고, 파일 이름과 서버 문구를 보여 줍니다.',
      control: 'object',
    },
    onConfirm: {
      description:
        '[확인]을 누르거나 딤 터치·Esc로 닫으면 알립니다. 받는 쪽은 안내한 사진을 비웁니다.',
    },
  },
  args: {
    photos: [
      {
        fileName: 'IMG_2101.JPG',
        message:
          '사진 해상도가 너무 높습니다. 5000만 화소 이하로 찍은 사진을 올려 주세요.',
      },
      {
        fileName: 'IMG_2104.HEIC',
        message: '사진을 읽을 수 없습니다. 다른 사진으로 다시 올려 주세요.',
      },
    ],
    onConfirm: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '440px' } },
  },
} satisfies Meta<typeof ServerRejectedDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
