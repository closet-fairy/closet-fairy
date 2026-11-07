import type { Meta, StoryObj } from '@storybook/react-vite';
import ClothesWandVisual from './ClothesWandVisual';

const meta = {
  component: ClothesWandVisual,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ClothesWandVisual>;

export default meta;

type Story = StoryObj<typeof meta>;

/*
 * 옷 6개를 2초씩 돌며 요술봉이 톡 쳐서 옷을 바꿉니다. 운영체제의 움직임 줄이기를 켜면 옷만 서서히 바뀝니다.
 */
export const Default: Story = {};
