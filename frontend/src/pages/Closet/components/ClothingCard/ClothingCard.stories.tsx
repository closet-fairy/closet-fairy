import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { ClothingCard as ClothingCardData } from '@/generated/models';
import ClothingCard from './ClothingCard';

// 390px 화면의 3열 그리드에서 카드 한 칸의 폭이다.
const CARD_WIDTH = 112;

const COMPLETED: ClothingCardData = {
  clothing_id: 1,
  processing_status_cd: 'completed',
  is_queued: false,
  image_url: '/media/clothing/1/sample_cutout.webp',
  failure_reason: null,
  is_new: false,
  category_cd: 'top',
  item_name: '스트라이프 반팔 티셔츠',
  created_at: '2026-10-25T10:00:00+09:00',
};

const meta = {
  component: ClothingCard,
  argTypes: {
    clothing: {
      description:
        '목록 API가 준 옷 카드입니다. 처리 상태(`processing_status_cd`, `is_queued`)에 따라 완료·처리 중·대기 중·실패 모습으로 그립니다.',
      control: 'object',
    },
    isRetrying: {
      description:
        '이 옷의 재시도 요청이 나가 있는지 정합니다. 그동안 실패 카드의 [재시도]는 눌리지 않습니다.',
      control: 'boolean',
    },
    onShowStatus: {
      description:
        '처리 중·대기 중·실패 카드를 누르면 알립니다. 받는 쪽은 상태 다이얼로그를 엽니다.',
    },
    onRetry: {
      description: '실패 카드의 [재시도]를 누르면 알립니다.',
    },
  },
  args: {
    clothing: COMPLETED,
    isRetrying: false,
    onShowStatus: fn(),
    onRetry: fn(),
  },
  render: (args) => (
    <div style={{ width: CARD_WIDTH }}>
      <ClothingCard {...args} />
    </div>
  ),
} satisfies Meta<typeof ClothingCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const New: Story = {
  args: {
    clothing: { ...COMPLETED, is_new: true },
  },
};

export const Untagged: Story = {
  args: {
    clothing: { ...COMPLETED, category_cd: null, item_name: null },
  },
};

export const Processing: Story = {
  args: {
    clothing: {
      ...COMPLETED,
      processing_status_cd: 'processing',
      image_url: '/media/clothing/1/sample.webp',
      category_cd: null,
      item_name: null,
    },
  },
};

export const Queued: Story = {
  args: {
    clothing: {
      ...COMPLETED,
      processing_status_cd: 'processing',
      is_queued: true,
      image_url: '/media/clothing/1/sample.webp',
      category_cd: null,
      item_name: null,
    },
  },
};

const FAILED: ClothingCardData = {
  ...COMPLETED,
  processing_status_cd: 'failed',
  image_url: '/media/clothing/1/sample.webp',
  failure_reason: '배경 제거에 실패했습니다.',
  category_cd: null,
  item_name: null,
};

export const Failed: Story = {
  args: {
    clothing: FAILED,
  },
};

export const Retrying: Story = {
  args: {
    clothing: FAILED,
    isRetrying: true,
  },
};

export const BrokenImage: Story = {
  args: {
    clothing: { ...COMPLETED, image_url: '/media/clothing/1/missing.webp' },
  },
};

export const LongName: Story = {
  args: {
    clothing: {
      ...COMPLETED,
      item_name: '오버핏 투웨이 지퍼 후드 집업 그레이 멜란지',
      category_cd: 'accessories',
    },
  },
};
