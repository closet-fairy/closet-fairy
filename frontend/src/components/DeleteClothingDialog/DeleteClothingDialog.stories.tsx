import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';
import DeleteClothingDialog from './DeleteClothingDialog';

const meta = {
  component: DeleteClothingDialog,
  argTypes: {
    clothingId: {
      description: '지울 옷의 id입니다.',
      control: 'number',
    },
    isOpen: {
      description: '확인 모달을 띄울지 정합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '[취소]·딤 터치·Esc로 닫을 때 `false`로 알립니다. 지우는 요청을 보내는 중에는 닫히지 않습니다.',
    },
    onDeleted: {
      description:
        '지웠거나 이미 지워진 옷이면 알립니다. 이 모달이 목록 캐시에서 그 카드를 빼고 "옷을 삭제했어요" 토스트를 띄운 뒤에 부릅니다. 받는 쪽이 모달을 닫습니다.',
    },
  },
  args: {
    clothingId: 1,
    isOpen: true,
    onOpenChange: fn(),
    onDeleted: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: '360px' } },
  },
} satisfies Meta<typeof DeleteClothingDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Deleting: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.delete('/api/clothing/:clothingId', async () => {
        await delay('infinite');

        return new HttpResponse(null, { status: 204 });
      }),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '삭제' }));
  },
};

export const Failed: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.delete('/api/clothing/:clothingId', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
          { status: 500 },
        ),
      ),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '삭제' }));
  },
};
