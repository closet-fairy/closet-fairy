import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ApiError } from '@/apis/apiError';
import HistoryDetailStatus from './HistoryDetailStatus';

const STATUS_WIDTH = 390;
const STATUS_HEIGHT = 600;

const meta = {
  component: HistoryDetailStatus,
  args: {
    error: null,
    isRetrying: false,
    onRetry: fn(),
    onGoToList: fn(),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: STATUS_WIDTH,
          height: STATUS_HEIGHT,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HistoryDetailStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const Failed: Story = {
  args: {
    error: new ApiError({
      code: 'INTERNAL',
      message: '서버에 연결할 수 없습니다.',
      status: 503,
    }),
  },
};

export const ClientError: Story = {
  args: {
    error: new ApiError({
      code: 'BAD_REQUEST',
      message: '요청이 올바르지 않습니다.',
      status: 422,
    }),
  },
};

export const NotFound: Story = {
  args: {
    error: new ApiError({
      code: 'SESSION_NOT_FOUND',
      message: '찾을 수 없습니다.',
      status: 404,
    }),
  },
};
