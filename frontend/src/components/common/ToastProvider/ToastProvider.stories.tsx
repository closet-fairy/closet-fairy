import type { Meta, StoryObj } from '@storybook/react-vite';
import Button from '@/components/common/Button';
import Toaster from '@/components/common/Toaster';
import { showToast } from './toast';
import ToastProvider from './ToastProvider';

const meta = {
  component: ToastProvider,
  argTypes: {
    children: {
      description:
        '토스트를 띄우고 그릴 영역입니다. 앱에서는 `RootLayout`이 화면 전체를 감싸고, 그 안에 `Toaster`를 한 번 둡니다. 토스트는 어디서든 `showToast`로 띄웁니다.',
      control: false,
    },
  },
  args: {
    children: null,
  },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '240px' } },
  },
  render: (args) => (
    <ToastProvider {...args}>
      <Button
        variant="outline"
        size="md"
        onClick={() => showToast({ tone: 'success', title: '옷을 삭제했어요' })}
      >
        토스트 띄우기
      </Button>
      <Toaster />
    </ToastProvider>
  ),
} satisfies Meta<typeof ToastProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
