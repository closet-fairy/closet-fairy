import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import OutfitActions from './OutfitActions';

const meta = {
  component: OutfitActions,
  argTypes: {
    onInfoClick: { description: '[정보 확인]을 누르면 호출됩니다.' },
    onAdoptClick: { description: '[채택하기]를 누르면 호출됩니다.' },
    onRequestClick: { description: '[수정 요청하기]를 누르면 호출됩니다.' },
    isDisabled: { description: '세 버튼을 모두 막습니다.', control: 'boolean' },
  },
  args: {
    onInfoClick: fn(),
    onAdoptClick: fn(),
    onRequestClick: fn(),
  },
} satisfies Meta<typeof OutfitActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { isDisabled: true },
};
