import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RecommendationHistoryItem } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import HistoryCard from './HistoryCard';

type Thumbnail = RecommendationHistoryItem['thumbnails'][number];

const CARD_WIDTH = 350;
const NOW = new Date('2026-10-31T12:00:00+09:00');

const createThumbnail = (
  slotCd: Thumbnail['slot_cd'],
  overrides: Partial<Thumbnail> = {},
): Thumbnail => ({
  slot_cd: slotCd,
  item_name: slotCd,
  image_url: cutoutUrl,
  ...overrides,
});

const ITEM: RecommendationHistoryItem = {
  recommendation_session_id: 41,
  recommended_at: '2026-10-31T10:12:00+09:00',
  condition: {
    tpo_cd: 'date',
    tpo_text: null,
    season_cd: 'fall',
    going_out_start_at: '2026-11-01T18:00:00+09:00',
    going_out_end_at: '2026-11-01T23:30:00+09:00',
    sido_nm: '서울특별시',
    sigungu_nm: '성동구',
  },
  weather: {
    temperature: 24,
    feels_like_temperature: 22,
    weather_condition_cd: 'overcast',
    is_fallback: false,
  },
  rating: 4,
  thumbnails: [
    createThumbnail('top'),
    createThumbnail('bottom'),
    createThumbnail('shoes'),
    createThumbnail('socks', { item_name: '흰 양말', image_url: null }),
  ],
};

const meta = {
  component: HistoryCard,
  args: { item: ITEM, now: NOW },
  decorators: [
    (Story) => (
      <div style={{ width: CARD_WIDTH }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HistoryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ManyItems: Story = {
  args: {
    item: {
      ...ITEM,
      thumbnails: [
        createThumbnail('outer'),
        ...ITEM.thumbnails,
        createThumbnail('accessories'),
        createThumbnail('accessories'),
      ],
    },
  },
};

export const LongCustomSituation: Story = {
  args: {
    item: {
      ...ITEM,
      condition: {
        ...ITEM.condition,
        tpo_cd: 'custom',
        tpo_text: '회사 동기 결혼식 2부 피로연이 강남 루프탑 바에서 있어서',
      },
    },
  },
};

export const EstimatedWeather: Story = {
  args: {
    item: {
      ...ITEM,
      weather: {
        temperature: 27,
        feels_like_temperature: 29,
        weather_condition_cd: 'clear',
        is_fallback: true,
      },
    },
  },
};

export const NoWeather: Story = {
  args: { item: { ...ITEM, weather: null } },
};

export const OldRecord: Story = {
  args: {
    item: {
      ...ITEM,
      recommended_at: '2026-08-22T07:50:00+09:00',
      condition: {
        ...ITEM.condition,
        going_out_start_at: '2026-08-22T08:30:00+09:00',
        going_out_end_at: '2026-08-22T18:00:00+09:00',
        sido_nm: '세종특별자치시',
        sigungu_nm: '세종특별자치시',
      },
    },
  },
};
