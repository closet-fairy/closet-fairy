import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ExcludedPhotosSheet from './ExcludedPhotosSheet';

const meta = {
  component: ExcludedPhotosSheet,
  argTypes: {
    isOpen: {
      description: '제외된 사진 목록을 띄울지 정합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '[확인]을 누르거나 딤 터치·아래로 밀어 닫으려 할 때 `false`를 받아 호출합니다.',
    },
    photos: {
      description:
        '형식·용량 때문에 미리 걸러 낸 사진입니다. 파일 이름과 사유를 한 줄씩 보여 줍니다.',
      control: 'object',
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    photos: [
      {
        id: '1',
        fileName: 'IMG_1983.GIF',
        message: 'JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요',
      },
      {
        id: '2',
        fileName: 'IMG_2012.HEIC',
        message: '20MB 이하 사진만 올릴 수 있어요',
      },
    ],
  },
  parameters: {
    docs: { story: { inline: false, height: '400px' } },
  },
} satisfies Meta<typeof ExcludedPhotosSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
