import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';
import { fn, userEvent, within } from 'storybook/test';
import useStoryOpenState from '../../../../../.storybook/useStoryOpenState';
import Button from '@/components/common/Button';
import RegionSearch from './RegionSearch';

const meta = {
  component: RegionSearch,
  argTypes: {
    isOpen: {
      description:
        '주소 입력 화면이 열려 있는지 정합니다. 제어형이라 닫힘 요청은 `onOpenChange`로 받아 다시 넘겨야 합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '뒤로 가기 버튼이나 Esc로 닫으려 할 때 `false`를 받아 호출합니다. 닫히면 검색어를 비웁니다.',
    },
    onSelect: {
      description:
        '검색 결과를 누르면 그 지역을 넘겨 호출합니다. 별도 확인 버튼 없이 곧바로 확정합니다.',
    },
    notice: {
      description:
        '검색창 위에 보여 줄 안내 문구입니다. 현재 위치를 쓰지 못해 이 화면으로 넘어온 이유를 알릴 때 씁니다.',
      control: 'text',
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    onSelect: fn(),
    notice: null,
  },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '640px' } },
  },
  render: function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          주소 입력 열기
        </Button>
        <RegionSearch
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          onSelect={(region) => {
            args.onSelect(region);
            setIsOpen(false);
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof RegionSearch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithResults: Story = {
  play: async () => {
    const searchbox = await within(document.body).findByRole('searchbox', {
      name: '지역 검색',
    });
    await userEvent.type(searchbox, '수원');
  },
};

export const NoResults: Story = {
  play: async () => {
    const searchbox = await within(document.body).findByRole('searchbox', {
      name: '지역 검색',
    });
    await userEvent.type(searchbox, '런던');
  },
};

export const WithNotice: Story = {
  args: {
    notice:
      '위치 권한이 없어 현재 위치를 쓸 수 없어요. 주소를 직접 입력해 주세요.',
  },
};

export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/regions', async () => {
        await delay('infinite');
        return HttpResponse.json([]);
      }),
    );
  },
};

export const LoadError: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/regions', () =>
        HttpResponse.json(
          { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류입니다.' },
          { status: 500 },
        ),
      ),
    );
  },
};
