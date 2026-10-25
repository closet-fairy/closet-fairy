import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';
import ProfileEditForm from './ProfileEditForm';

const meta = {
  component: ProfileEditForm,
  argTypes: {
    me: {
      description: '내 정보 조회 응답입니다. 닉네임의 처음 값으로 씁니다.',
      control: 'object',
    },
    settings: {
      description:
        '개인 설정 조회 응답입니다. 체질·성별·선호 스타일의 처음 값으로 쓰고, 저장할 때 출생연도를 그대로 다시 보냅니다.',
      control: 'object',
    },
  },
  args: {
    me: {
      nickname: '김하늘',
      provider_cd: 'google',
      created_at: '2026-08-12T10:00:00+09:00',
      is_onboarded: true,
    },
    settings: {
      birth_year: 2001,
      temperature_sensitivity_cd: 'cold_sensitive',
      gender_cd: 'female',
      style_cds: ['minimal', 'casual', 'classic'],
      is_onboarded: true,
    },
  },
  parameters: {
    layout: 'fullscreen',
    initialPath: '/my-info/edit',
    docs: { story: { inline: false, height: '720px' } },
  },
} satisfies Meta<typeof ProfileEditForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyNicknameError: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.clear(canvas.getByRole('textbox', { name: '닉네임' }));
    await userEvent.click(canvas.getByRole('button', { name: '저장' }));
  },
};

export const Saving: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.put('/api/members/me/settings', async () => {
        await delay('infinite');

        return HttpResponse.json(null);
      }),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '저장' }));
  },
};

export const SaveFailed: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.put('/api/members/me/settings', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '저장' }));
  },
};
