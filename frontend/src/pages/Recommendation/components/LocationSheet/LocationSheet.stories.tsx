import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';
import useStoryOpenState from '../../../../../.storybook/useStoryOpenState';
import Button from '@/components/common/Button';
import LocationSheet from './LocationSheet';

// 스토리를 열 때마다 실제 위치 권한 창이 뜨지 않도록 서울 성동구청 좌표를 바로 돌려준다.
const stubGeolocation = () => {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: (onSuccess: PositionCallback) => {
        onSuccess({
          coords: {
            latitude: 37.5634,
            longitude: 127.0369,
            accuracy: 100,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        });
      },
    },
    configurable: true,
  });

  return () => {
    Reflect.deleteProperty(navigator, 'geolocation');
  };
};

const meta = {
  component: LocationSheet,
  argTypes: {
    isOpen: {
      description:
        '시트가 열려 있는지 정합니다. 제어형이라 닫힘 요청은 `onOpenChange`로 받아 다시 넘겨야 합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '닫기 버튼, 딤 터치, 끌어내리기로 닫으려 할 때 `false`를 받아 호출합니다.',
    },
    onSelect: {
      description:
        '위치가 정해지면 호출합니다. 현재 위치로 찾았으면 `inputTypeCd`가 `current`, 주소를 검색해 골랐으면 `manual`입니다. 위치가 정해지면 시트가 `onOpenChange(false)`로 스스로 닫힘을 요청합니다.',
    },
    finalFocus: {
      description: '시트가 닫힌 뒤 포커스를 돌려줄 요소의 ref입니다.',
      control: false,
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    onSelect: fn(),
  },
  beforeEach: stubGeolocation,
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '640px' } },
  },
  render: function Render(args) {
    const { isOpen, handleOpenChange } = useStoryOpenState(args);

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          위치 설정 열기
        </Button>
        <LocationSheet
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
        />
      </>
    );
  },
} satisfies Meta<typeof LocationSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RegionNotFound: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.post('/api/regions/nearest', () =>
        HttpResponse.json(
          { code: 'REGION_NOT_FOUND', message: '지원하지 않는 지역입니다.' },
          { status: 404 },
        ),
      ),
    );
  },
};

export const Locating: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.post('/api/regions/nearest', async () => {
        await delay('infinite');
        return HttpResponse.json({
          sido_nm: '서울특별시',
          sigungu_nm: '성동구',
        });
      }),
    );
  },
};
