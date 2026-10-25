import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';
import type { WeatherPreview } from '@/generated/models';
import WeatherSummary from './WeatherSummary';

const createPreview = (overrides: Partial<WeatherPreview> = {}) => ({
  temperature: 24.3,
  feels_like_temperature: 25.1,
  weather_condition_cd: 'overcast',
  is_fallback: false,
  is_sky_missing: false,
  ...overrides,
});

const meta = {
  component: WeatherSummary,
  argTypes: {
    sidoNm: {
      description: '날씨를 조회할 시·도 정식 이름입니다.',
      control: 'text',
    },
    sigunguNm: {
      description:
        '날씨를 조회할 시·군·구 이름입니다. 없는 이름이면 BE가 시·도 대표 지점의 날씨를 줍니다.',
      control: 'text',
    },
  },
  args: {
    sidoNm: '서울특별시',
    sigunguNm: '성동구',
  },
  parameters: {
    docs: { story: { inline: false, height: '80px' } },
  },
} satisfies Meta<typeof WeatherSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Rain: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/weather/preview', () =>
        HttpResponse.json(
          createPreview({ temperature: 17.6, weather_condition_cd: 'rain' }),
        ),
      ),
    );
  },
};

export const SkyMissing: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/weather/preview', () =>
        HttpResponse.json(
          createPreview({
            weather_condition_cd: 'clear',
            is_sky_missing: true,
          }),
        ),
      ),
    );
  },
};

export const Fallback: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/weather/preview', () =>
        HttpResponse.json(createPreview({ is_fallback: true })),
      ),
    );
  },
};

export const LoadError: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/weather/preview', () =>
        HttpResponse.json(
          { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류입니다.' },
          { status: 500 },
        ),
      ),
    );
  },
};

export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/weather/preview', async () => {
        await delay('infinite');
        return HttpResponse.json(createPreview());
      }),
    );
  },
};
