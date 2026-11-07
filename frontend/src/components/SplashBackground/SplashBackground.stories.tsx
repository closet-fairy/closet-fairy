import type { Meta, StoryObj } from '@storybook/react-vite';
import SplashScreen from '@/components/SplashScreen';
import SplashBackground from './SplashBackground';

const meta = {
  component: SplashBackground,
  argTypes: {
    children: {
      description:
        '영상 배경 위에 올릴 화면입니다. 영상 4개를 차례로 반복해서 깔고 그 위에 어두운 막을 덮습니다. 움직임 줄이기에서는 첫 프레임 정지 이미지를, 데이터 절약 모드와 자동 재생이 막힌 경우에는 단색 배경을 보여 줍니다.',
      control: false,
    },
  },
  args: {
    children: <SplashScreen />,
  },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '480px' } },
  },
} satisfies Meta<typeof SplashBackground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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

export const DataSaver: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });

    return () => {
      Reflect.deleteProperty(navigator, 'connection');
    };
  },
};

export const AutoplayBlocked: Story = {
  beforeEach: () => {
    const original = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      'play',
    );

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      value: () =>
        Promise.reject(new DOMException('blocked', 'NotAllowedError')),
      configurable: true,
      writable: true,
    });

    return () => {
      if (original !== undefined) {
        Object.defineProperty(HTMLMediaElement.prototype, 'play', original);
      }
    };
  },
};
