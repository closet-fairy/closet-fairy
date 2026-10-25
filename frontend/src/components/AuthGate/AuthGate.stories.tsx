import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';
import AuthGate from './AuthGate';

const meta = {
  component: AuthGate,
  argTypes: {
    children: {
      description:
        '로그인과 온보딩 상태가 지금 주소에 맞을 때 보여 줄 화면입니다. 맞지 않으면 로그인·온보딩·옷장 중 맞는 곳으로 보냅니다. 회원 정보를 확인하는 동안에는 스플래시를, 401이 아닌 이유로 확인하지 못하면 다시 시도 화면을 보여 줍니다.',
      control: false,
    },
  },
  args: {
    children: '로그인한 화면',
  },
  parameters: {
    layout: 'fullscreen',
    initialPath: '/closet',
    docs: { story: { inline: false, height: '480px' } },
  },
} satisfies Meta<typeof AuthGate>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {};

export const Checking: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/members/me', async () => {
        await delay('infinite');

        return HttpResponse.json(null);
      }),
    );
  },
};

export const LoadFailed: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/members/me', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
  },
};
