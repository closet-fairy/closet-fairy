import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClothingStatusDialog from './ClothingStatusDialog';

const meta = {
  component: ClothingStatusDialog,
  argTypes: {
    isOpen: {
      description: '다이얼로그를 띄울지 정합니다.',
      control: 'boolean',
    },
    variant: {
      description:
        '누른 카드의 처리 상태입니다. `processing`은 처리 중·대기 중 카드, `failed`는 등록에 실패한 카드에서 엽니다.',
      control: 'inline-radio',
      options: ['processing', 'failed'],
    },
    failureReason: {
      description:
        '서버가 준 실패 사유입니다. `failed`일 때 설명 줄에 그대로 보여 줍니다.',
      control: 'text',
    },
    isRetrying: {
      description:
        '재시도 요청이 나가 있는지 정합니다. 그동안 [재시도]는 눌리지 않습니다.',
      control: 'boolean',
    },
    onRetry: {
      description: '[재시도]를 누르면 알립니다.',
    },
    onDelete: {
      description:
        '[삭제]를 누르면 알립니다. 받는 쪽은 이 다이얼로그를 닫고 삭제 확인 모달을 엽니다.',
    },
    onClose: {
      description: '[닫기]를 누르거나 딤 터치·Esc로 닫으면 알립니다.',
    },
  },
  args: {
    isOpen: true,
    variant: 'processing',
    failureReason: null,
    isRetrying: false,
    onRetry: fn(),
    onDelete: fn(),
    onClose: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '440px' } },
  },
} satisfies Meta<typeof ClothingStatusDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Processing: Story = {};

export const Failed: Story = {
  args: {
    variant: 'failed',
    failureReason: '배경 제거에 실패했습니다.',
  },
};

export const Retrying: Story = {
  args: {
    variant: 'failed',
    failureReason: '배경 제거에 실패했습니다.',
    isRetrying: true,
  },
};
