import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import FormField from '@/components/common/FormField';
import LocationField from './LocationField';

const meta = {
  component: LocationField,
  argTypes: {
    location: {
      description:
        '고른 위치입니다. `null`이면 위치를 고르라는 안내를 보여 주고, 위치가 있으면 짧은 지역 이름과 그 지역의 날씨를 보여 줍니다.',
      control: 'object',
    },
    onClick: {
      description: '필드를 누를 때 호출합니다. 위치 설정 시트를 엽니다.',
    },
    ref: {
      description:
        '필드 버튼의 ref입니다. 시트를 닫은 뒤 포커스를 돌려줄 때 씁니다.',
      control: false,
    },
  },
  args: {
    location: {
      sidoNm: '서울특별시',
      sigunguNm: '성동구',
      inputTypeCd: 'manual',
    },
    onClick: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '120px' } },
  },
  decorators: [
    (Story) => (
      <FormField label="위치">
        <Story />
      </FormField>
    ),
  ],
} satisfies Meta<typeof LocationField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    location: null,
  },
};

export const LongRegionName: Story = {
  args: {
    location: {
      sidoNm: '경상남도',
      sigunguNm: '창원시 마산회원구',
      inputTypeCd: 'current',
    },
  },
};

export const SameSidoAndSigungu: Story = {
  args: {
    location: {
      sidoNm: '세종특별자치시',
      sigunguNm: '세종특별자치시',
      inputTypeCd: 'manual',
    },
  },
};
