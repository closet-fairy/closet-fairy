import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StoryStack from '../../../../../.storybook/StoryStack';
import SocialLoginButton from './SocialLoginButton';

// 가장 좁은 화면(320px)에서 좌우 여백 24px을 뺀 폭이다.
const NARROW_WIDTH = 272;

const meta = {
  component: SocialLoginButton,
  argTypes: {
    provider: {
      description:
        '로그인 제공자입니다. 문구, 로고, 색은 각 회사의 브랜드 규정을 따르며 제공자에 따라 정해집니다.',
      control: 'inline-radio',
      options: ['google', 'kakao'],
    },
    isDisabled: {
      description:
        '누를 수 없게 합니다. 로그인 주소로 이동하는 동안 두 버튼을 함께 막을 때 씁니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onClick: {
      description:
        '버튼을 누르면 제공자와 함께 호출됩니다. 비활성이면 호출되지 않습니다.',
    },
  },
  args: {
    provider: 'google',
    onClick: fn(),
  },
} satisfies Meta<typeof SocialLoginButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Google: Story = {};

export const Kakao: Story = {
  args: { provider: 'kakao' },
};

export const Disabled: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={10}>
      <SocialLoginButton {...args} provider="google" isDisabled />
      <SocialLoginButton {...args} provider="kakao" isDisabled />
    </StoryStack>
  ),
};

export const NarrowWidth: Story = {
  render: (args) => (
    <div style={{ width: NARROW_WIDTH }}>
      <StoryStack direction="column" gap={10}>
        <SocialLoginButton {...args} provider="google" />
        <SocialLoginButton {...args} provider="kakao" />
      </StoryStack>
    </div>
  ),
};
