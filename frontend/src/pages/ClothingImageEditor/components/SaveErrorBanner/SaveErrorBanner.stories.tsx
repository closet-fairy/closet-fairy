import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import SaveErrorBanner from './SaveErrorBanner';

const meta = {
  component: SaveErrorBanner,
  argTypes: {
    message: {
      description:
        '보여 줄 오류 문구입니다. 서버 메시지를 그대로 넘기고, 서버 메시지가 없으면 "이미지를 저장하지 못했어요."를 넘깁니다.',
      control: 'text',
    },
    isDisabled: {
      description: '[다시 시도]를 막을지 정합니다. 저장하는 동안 막습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onRetry: {
      description:
        '[다시 시도]를 누르면 알립니다. 상단 바의 [저장]과 같은 일을 합니다.',
    },
  },
  args: {
    message: '처리가 끝난 옷만 수정할 수 있습니다.',
    isDisabled: false,
    onRetry: fn(),
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SaveErrorBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Fallback: Story = {
  args: {
    message: '이미지를 저장하지 못했어요.',
  },
};

export const LongMessage: Story = {
  args: {
    message:
      '브러시 마스크를 읽을 수 없습니다. 다시 그려서 올려 주세요. 같은 문제가 계속되면 잠시 뒤에 다시 시도해 주세요.',
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};
