import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { ClothingDetail } from '@/generated/models';
import ClothingAttributes from './ClothingAttributes';

// 390px 화면에서 좌우 여백을 뺀 폭이다.
const SECTION_WIDTH = 350;

const CLOTHING: ClothingDetail = {
  clothing_id: 1,
  processing_status_cd: 'completed',
  is_queued: false,
  image_url: '/media/clothing/1/sample_cutout.webp',
  failure_reason: null,
  is_new: false,
  category_cd: 'top',
  item_name: '베이지 터틀넥',
  created_at: '2026-10-29T10:00:00+09:00',
  origin_image_url: '/media/clothing/1/sample.webp',
  cutout_image_url: '/media/clothing/1/sample_cutout.webp',
  accessory_type_cd: null,
  color_cd: 'beige',
  color_text: null,
  thickness_cd: 'medium',
  is_waterproof: false,
  style_cds: ['minimal', 'casual'],
  season_cds: ['fall', 'winter'],
  edit: null,
};

const meta = {
  component: ClothingAttributes,
  argTypes: {
    clothing: {
      description:
        '보여 줄 옷 상세입니다. 저장을 기다리는 값이 있으면 그 값을 먼저 반영한 상세를 넘깁니다.',
      control: 'object',
    },
    errors: {
      description:
        '저장하지 못한 속성마다 서버 문구입니다. 그 행 아래에 에러 색으로 보여 줍니다.',
      control: 'object',
    },
    onSave: {
      description:
        '칩을 누르면 바로 그 속성만 저장하도록 알립니다. 필드 이름, 보낼 값, 떠난 뒤 실패했을 때의 토스트 제목을 넘깁니다.',
    },
  },
  args: {
    clothing: CLOTHING,
    errors: {},
    onSave: fn(),
  },
  render: (args) => (
    <div style={{ width: SECTION_WIDTH }}>
      <ClothingAttributes {...args} />
    </div>
  ),
} satisfies Meta<typeof ClothingAttributes>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    clothing: {
      ...CLOTHING,
      category_cd: null,
      color_cd: null,
      thickness_cd: null,
      is_waterproof: null,
      style_cds: [],
      season_cds: [],
    },
  },
};

export const Accessory: Story = {
  args: {
    clothing: {
      ...CLOTHING,
      category_cd: 'accessories',
      accessory_type_cd: 'hat',
      color_cd: 'navy',
    },
  },
};

export const SaveFailed: Story = {
  args: {
    errors: { color_cd: '서버에 연결할 수 없습니다.' },
  },
};
