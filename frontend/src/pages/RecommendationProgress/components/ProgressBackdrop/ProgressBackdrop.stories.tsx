import type { Meta, StoryObj } from '@storybook/react-vite';
import StatusView from '@/components/common/StatusView';
import ClothesWandVisual from '../ClothesWandVisual';
import ProgressBackdrop from './ProgressBackdrop';

const meta = {
  component: ProgressBackdrop,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    children: {
      description:
        '영상 위에 올릴 화면입니다. 영상은 처음 1초 동안 보이지 않다가 1초에 걸쳐 70%까지 나타납니다. 움직임 줄이기, 데이터 절약 모드, 자동 재생 차단일 때는 영상 대신 첫 프레임 정지 이미지를 같은 방식으로 보여 줍니다.',
      control: false,
    },
  },
} satisfies Meta<typeof ProgressBackdrop>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <StatusView
        visual={<ClothesWandVisual />}
        visualPlacement="bottom"
        title="코디를 만들고 있어요"
        description="잠시만 기다려 주세요..."
      />
    ),
  },
};
