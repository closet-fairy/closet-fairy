import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';
import LogoutDialog from './LogoutDialog';

const meta = {
  component: LogoutDialog,
  argTypes: {
    isOpen: {
      description: '확인 모달을 띄울지 정합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '[취소]·딤 터치·Esc로 닫을 때 `false`로 알립니다. 로그아웃 요청을 보내는 중에는 닫히지 않습니다. 로그아웃에 성공하면 이 모달이 직접 캐시를 비우고 로그인 화면으로 보냅니다.',
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '360px' } },
  },
} satisfies Meta<typeof LogoutDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LoggingOut: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.post('/api/auth/logout', async () => {
        await delay('infinite');

        return new HttpResponse(null, { status: 204 });
      }),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: '로그아웃' }),
    );
  },
};

export const Failed: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.post('/api/auth/logout', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: '로그아웃' }),
    );
  },
};
