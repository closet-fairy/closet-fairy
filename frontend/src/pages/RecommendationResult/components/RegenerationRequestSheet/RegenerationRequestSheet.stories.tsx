import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RegenerationRequestSheet from './RegenerationRequestSheet';

const meta = {
  component: RegenerationRequestSheet,
  parameters: { docs: { story: { inline: false, height: '520px' } } },
  argTypes: {
    isOpen: { description: '시트가 열려 있는지입니다.' },
    onOpenChange: { description: '시트를 닫으려 할 때 호출됩니다.' },
    outfitCount: {
      description:
        '결과의 코디 수입니다. 대상 선택에 그대로 쓰이고, 1벌이면 대상 선택을 숨깁니다.',
      control: 'number',
    },
    isSubmitting: { description: '요청을 보내는 중인지입니다.' },
    errorMessage: { description: '입력란 아래에 보여 줄 서버 문구입니다.' },
    onTextChange: { description: '입력값이 바뀌면 호출됩니다.' },
    onSubmit: { description: '[수정 요청하기]를 누르면 호출됩니다.' },
    finalFocus: { description: '닫힌 뒤 포커스를 돌려줄 요소입니다.' },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    outfitCount: 4,
    isSubmitting: false,
    onTextChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof RegenerationRequestSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ThreeOutfits: Story = {
  args: { outfitCount: 3 },
};

export const SingleOutfit: Story = {
  args: { outfitCount: 1 },
};

export const Submitting: Story = {
  args: { isSubmitting: true },
};

export const WithError: Story = {
  args: { errorMessage: '요청을 이해하지 못했습니다. 다시 말씀해 주세요.' },
};
