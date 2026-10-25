import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  markSessionActive,
  reportUnauthorized,
  resetSession,
} from '@/apis/authSession';
import SessionExpiredDialog from './SessionExpiredDialog';

const meta = {
  component: SessionExpiredDialog,
  parameters: {
    docs: {
      description: {
        component:
          '로그인한 채 쓰던 중에 API가 401을 돌려주면 앱 전체에 하나만 뜨는 만료 안내입니다. 바깥을 누르거나 Esc로 닫을 수 없고, [다시 로그인]을 누르면 캐시를 비우고 로그인 화면으로 갑니다. 이 스토리는 만료 상태를 직접 켜서 보여 줍니다.',
      },
      story: { inline: false, height: '360px' },
    },
  },
  beforeEach: () => {
    markSessionActive();
    reportUnauthorized();

    return () => {
      resetSession();
    };
  },
} satisfies Meta<typeof SessionExpiredDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
