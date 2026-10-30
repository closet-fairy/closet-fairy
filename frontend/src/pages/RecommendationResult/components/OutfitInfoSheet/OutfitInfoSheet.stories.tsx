import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { OutfitResult } from '@/generated/models';
import cutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import OutfitInfoSheet from './OutfitInfoSheet';

const OUTFIT: OutfitResult = {
  outfit_id: 1,
  outfit_seq: 1,
  outfit_type_cd: 'preferred',
  reason:
    '흐리고 선선해서 얇은 니트 한 겹으로 맞췄어요. 미니멀을 좋아하셔서 색을 셋으로 줄였어요.',
  items: [
    {
      slot_cd: 'top',
      accessory_type_cd: null,
      item_source_cd: 'owned',
      item_name: '베이지 터틀넥',
      image_url: cutoutUrl,
      style_cds: ['minimal'],
    },
    {
      slot_cd: 'bottom',
      accessory_type_cd: null,
      item_source_cd: 'owned',
      item_name: '그레이 슬랙스',
      image_url: cutoutUrl,
      style_cds: ['minimal', 'casual'],
    },
    {
      slot_cd: 'shoes',
      accessory_type_cd: null,
      item_source_cd: 'owned',
      item_name: '브라운 스니커즈',
      image_url: cutoutUrl,
      style_cds: ['casual'],
    },
    {
      slot_cd: 'socks',
      accessory_type_cd: null,
      item_source_cd: 'essential',
      item_name: '흰 양말',
      image_url: null,
      style_cds: [],
    },
  ],
  previous_outfits: [],
};

const WEATHER = {
  temperature: 24,
  feels_like_temperature: 23,
  weather_condition_cd: 'overcast',
  is_fallback: false,
} as const;

const meta = {
  component: OutfitInfoSheet,
  parameters: { docs: { story: { inline: false, height: '640px' } } },
  argTypes: {
    outfit: { description: '보여 줄 코디입니다.', control: 'object' },
    weather: {
      description:
        '추천 시점 날씨입니다. `is_fallback`이면 [추정]과 안내 문구를 함께 보여 줍니다.',
      control: 'object',
    },
    isClothingShortage: {
      description:
        '옷장이 부족한 회원이면 맨 위에 등록 유도 안내를 보여 줍니다.',
    },
    isOpen: { description: '서랍이 열려 있는지입니다.' },
    onOpenChange: { description: '서랍을 닫으려 할 때 호출됩니다.' },
    finalFocus: { description: '닫힌 뒤 포커스를 돌려줄 요소입니다.' },
  },
  args: {
    outfit: OUTFIT,
    weather: WEATHER,
    isClothingShortage: false,
    isOpen: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof OutfitInfoSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ClothingShortage: Story = {
  args: { isClothingShortage: true },
};

export const EstimatedWeather: Story = {
  args: { weather: { ...WEATHER, is_fallback: true } },
};

export const WithoutReason: Story = {
  args: { outfit: { ...OUTFIT, reason: null } },
};

export const ManyItems: Story = {
  args: {
    outfit: {
      ...OUTFIT,
      items: Array.from({ length: 16 }, (_, index) => ({
        ...OUTFIT.items[0],
        item_name: `아이템 ${index + 1}`,
      })),
    },
  },
};
