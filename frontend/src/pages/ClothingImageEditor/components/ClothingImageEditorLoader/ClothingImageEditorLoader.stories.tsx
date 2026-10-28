import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';
import type { ClothingDetail, ClothingEdit } from '@/generated/models';
import ClothingImageEditorLoader from './ClothingImageEditorLoader';

// mocks/handlers/clothing.ts가 내려 주는 샘플 이미지 주소다.
const SAMPLE_MEDIA = {
  origin: '/media/clothing/1/sample.webp',
  cutout: '/media/clothing/1/sample_cutout.webp',
  mask: '/media/clothing/1/sample_mask.png',
} as const;

const createClothing = (
  clothingId: number,
  edit: ClothingEdit | null = null,
): ClothingDetail => ({
  clothing_id: clothingId,
  processing_status_cd: 'completed',
  is_queued: false,
  image_url: SAMPLE_MEDIA.cutout,
  failure_reason: null,
  is_new: false,
  category_cd: 'top',
  item_name: '스트라이프 반팔 티셔츠',
  created_at: '2026-10-25T10:00:00+09:00',
  origin_image_url: SAMPLE_MEDIA.origin,
  cutout_image_url: SAMPLE_MEDIA.cutout,
  accessory_type_cd: null,
  color_cd: 'blue',
  color_text: '파랑',
  thickness_cd: 'thin',
  is_waterproof: false,
  style_cds: ['casual'],
  season_cds: ['summer'],
  edit,
});

const meta = {
  component: ClothingImageEditorLoader,
  argTypes: {
    clothing: {
      description:
        '편집할 옷의 상세 응답입니다. 처음 받은 값으로 이미지를 불러오고 편집기를 열며, 저장 응답으로 상세가 바뀌어도 다시 불러오지 않습니다.',
      control: false,
    },
    onClose: {
      description:
        '편집기를 닫을 때 알립니다. 저장 성공, 바뀐 게 없는 닫기, 버리기 확정에서 부릅니다.',
    },
    onNotFound: {
      description:
        '저장하다 옷이 지워진 것을 알게 되면, 옷을 찾을 수 없다는 안내의 [확인]에서 알립니다. 받는 쪽은 돌아갈 상세가 없으므로 옷장으로 보냅니다.',
    },
  },
  args: {
    clothing: createClothing(1),
    onClose: fn(),
    onNotFound: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '720px' } },
  },
} satisfies Meta<typeof ClothingImageEditorLoader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoEdit: Story = {};

export const Edited: Story = {
  args: {
    clothing: createClothing(2, {
      rotation_angle: 8,
      perspective_param: {
        corners: [
          [0.02, 0.01],
          [0.98, 0.02],
          [0.99, 0.99],
          [0.01, 0.98],
        ],
      },
      brush_mask_url: SAMPLE_MEDIA.mask,
      display_image_url: null,
    }),
  },
};

export const InvalidSavedPerspective: Story = {
  args: {
    clothing: createClothing(1, {
      rotation_angle: 0,
      perspective_param: { corners: [[0, 0]] },
      brush_mask_url: null,
      display_image_url: null,
    }),
  },
};

// 저장하면 409로 실패해 서버 메시지를 배너로 보여 준다.
export const NotEditable: Story = {
  args: {
    clothing: createClothing(409),
  },
};

// 회전·원근 저장은 되고 표시 이미지 저장만 500으로 실패해, 다시 시도하면 표시 이미지부터 이어 보낸다.
export const DisplaySaveFails: Story = {
  args: {
    clothing: createClothing(500),
  },
};

// 목록에 없는 옷이라 저장하면 404로 실패해 안내 다이얼로그를 띄운다.
export const DeletedWhileEditing: Story = {
  args: {
    clothing: createClothing(404),
  },
};

export const LoadFailed: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/media/*', () => new HttpResponse(null, { status: 404 })),
    );
  },
};
