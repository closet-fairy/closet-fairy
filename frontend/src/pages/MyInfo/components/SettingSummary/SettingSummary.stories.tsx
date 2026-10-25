import type { Meta, StoryObj } from '@storybook/react-vite';
import SettingSummary from './SettingSummary';

const meta = {
  component: SettingSummary,
  argTypes: {
    settings: {
      description:
        '개인 설정 조회 응답입니다. 출생연도는 연령대로 바꿔 보여 주고, 비어 있는 출생연도·체질·스타일은 "선택 안 함"으로 보여 줍니다.',
      control: 'object',
    },
    currentYear: {
      description: '연령대를 계산할 기준 연도(KST)입니다.',
      control: 'number',
    },
  },
  args: {
    settings: {
      birth_year: 2001,
      temperature_sensitivity_cd: 'cold_sensitive',
      gender_cd: 'female',
      style_cds: ['minimal', 'casual', 'classic'],
      is_onboarded: true,
    },
    currentYear: 2026,
  },
} satisfies Meta<typeof SettingSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NothingSelected: Story = {
  args: {
    settings: {
      birth_year: null,
      temperature_sensitivity_cd: null,
      gender_cd: 'unisex',
      style_cds: [],
      is_onboarded: true,
    },
  },
};

export const ManyStyles: Story = {
  args: {
    settings: {
      birth_year: 1990,
      temperature_sensitivity_cd: 'heat_sensitive',
      gender_cd: 'male',
      style_cds: [
        'minimal',
        'casual',
        'street',
        'classic',
        'formal',
        'sporty',
        'vintage',
        'chic',
      ],
      is_onboarded: true,
    },
  },
};
