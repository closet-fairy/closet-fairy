import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClothingRegistration from './ClothingRegistration';

const meta = {
  component: ClothingRegistration,
  argTypes: {
    isSheetOpen: {
      description:
        '등록 방법을 고르는 시트를 띄울지 정합니다. [갤러리에서 선택]이나 [사진 촬영]을 누르면 시트를 닫고 사진 고르기 창이나 카메라를 엽니다.',
      control: 'boolean',
    },
    onSheetOpenChange: {
      description:
        '시트를 닫거나 [갤러리에서 선택]·[사진 촬영]을 눌렀을 때 `false`를 받아 호출합니다.',
    },
  },
  args: {
    isSheetOpen: true,
    onSheetOpenChange: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '360px' } },
  },
} satisfies Meta<typeof ClothingRegistration>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
