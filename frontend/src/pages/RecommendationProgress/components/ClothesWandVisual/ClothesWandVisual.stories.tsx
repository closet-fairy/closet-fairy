import type { Meta, StoryObj } from '@storybook/react-vite';
import ClothesWandVisual from './ClothesWandVisual';

const meta = {
  component: ClothesWandVisual,
  parameters: {
    layout: 'centered',
    docs: { story: { inline: false, height: '240px' } },
  },
} satisfies Meta<typeof ClothesWandVisual>;

export default meta;

type Story = StoryObj<typeof meta>;

/*
 * 옷 6개를 2초씩 돌며 요술봉이 톡 쳐서 옷을 바꿉니다.
 */
export const Default: Story = {};

/*
 * 운영체제의 움직임 줄이기를 켠 모습입니다. 튀어나오기, 요술봉 회전, 점 퍼짐 없이 옷만 서서히 바뀝니다.
 */
export const ReducedMotion: Story = {
  beforeEach: () => {
    const original = Object.getOwnPropertyDescriptor(
      MediaQueryList.prototype,
      'matches',
    );

    Object.defineProperty(MediaQueryList.prototype, 'matches', {
      get: () => true,
      configurable: true,
    });

    return () => {
      if (original !== undefined) {
        Object.defineProperty(MediaQueryList.prototype, 'matches', original);
      }
    };
  },
};
