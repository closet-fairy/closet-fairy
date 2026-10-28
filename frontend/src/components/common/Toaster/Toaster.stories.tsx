import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import StoryStack from '../../../../.storybook/StoryStack';
import Button from '@/components/common/Button';
import ToastProvider from '@/components/common/ToastProvider';
import type { ToastTone } from '@/components/common/ToastProvider/toast';
import {
  showToast,
  toastManager,
} from '@/components/common/ToastProvider/toast';
import Toaster from './Toaster';

interface StoryToast {
  tone: ToastTone;
  title: string;
  description?: string;
}

const SUCCESS_TOASTS: StoryToast[] = [
  { tone: 'success', title: '옷을 삭제했어요' },
];

const ERROR_TOASTS: StoryToast[] = [
  {
    tone: 'error',
    title: '색상을 저장하지 못했어요',
    description: '서버에 연결할 수 없습니다.',
  },
];

const INFO_TOASTS: StoryToast[] = [
  { tone: 'info', title: '옷을 찾을 수 없어요' },
];

const STACKED_TOASTS: StoryToast[] = [
  {
    tone: 'error',
    title: '옷 등록 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  },
  { tone: 'success', title: '옷을 삭제했어요' },
  { tone: 'info', title: '옷을 찾을 수 없어요' },
];

// 스크린샷과 문서에서 계속 보이도록 저절로 사라지지 않게 띄운다. 다시 마운트돼도 두 번 쌓이지 않게 id를 고정한다.
const useStaticToasts = (storyToasts: StoryToast[]) => {
  useEffect(() => {
    storyToasts.forEach((toast, index) => {
      showToast({ ...toast, id: `story-toast-${index}`, timeout: 0 });
    });

    return () => toastManager.close();
  }, [storyToasts]);
};

const meta = {
  component: Toaster,
  argTypes: {
    bottomOffset: {
      description:
        '화면 아래에서 토스트를 띄울 높이(px)입니다. 하단 탭 바가 보이는 화면에서는 탭 바 높이를 넘겨 그 위에 띄우고, 탭 바가 없으면 0입니다. 아래쪽 안전 영역은 따로 더합니다.',
      control: 'number',
      table: { defaultValue: { summary: '0' } },
    },
  },
  args: {
    bottomOffset: 0,
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '360px' } },
  },
  render: function Render(args) {
    return (
      <>
        <StoryStack>
          <Button
            variant="outline"
            size="md"
            onClick={() =>
              showToast({ tone: 'success', title: '옷을 삭제했어요' })
            }
          >
            완료 알림
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() =>
              showToast({ tone: 'info', title: '옷을 찾을 수 없어요' })
            }
          >
            안내
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() =>
              showToast({
                tone: 'error',
                title: '색상을 저장하지 못했어요',
                description: '서버에 연결할 수 없습니다.',
              })
            }
          >
            에러
          </Button>
        </StoryStack>
        <Toaster {...args} />
      </>
    );
  },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Success: Story = {
  render: function Render(args) {
    useStaticToasts(SUCCESS_TOASTS);

    return <Toaster {...args} />;
  },
};

export const ErrorToast: Story = {
  render: function Render(args) {
    useStaticToasts(ERROR_TOASTS);

    return <Toaster {...args} />;
  },
};

export const Stacked: Story = {
  render: function Render(args) {
    useStaticToasts(STACKED_TOASTS);

    return <Toaster {...args} />;
  },
};

export const AboveTabBar: Story = {
  args: {
    bottomOffset: 67,
  },
  render: function Render(args) {
    useStaticToasts(INFO_TOASTS);

    return <Toaster {...args} />;
  },
};
