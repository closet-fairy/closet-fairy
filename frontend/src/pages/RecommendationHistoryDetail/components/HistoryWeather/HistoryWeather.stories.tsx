import type { Meta, StoryObj } from '@storybook/react-vite';
import HistoryWeather from './HistoryWeather';

const WEATHER_WIDTH = 350;

const meta = {
  component: HistoryWeather,
  args: {
    weather: {
      temperature: 24,
      feels_like_temperature: 22,
      weather_condition_cd: 'rain',
      is_fallback: false,
      precipitation: 1.5,
      wind_speed: 3.2,
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: WEATHER_WIDTH }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HistoryWeather>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPrecipitation: Story = {
  args: {
    weather: {
      temperature: 27,
      feels_like_temperature: 29,
      weather_condition_cd: 'clear',
      is_fallback: false,
      precipitation: 0,
      wind_speed: 1.2,
    },
  },
};

export const Estimated: Story = {
  args: {
    weather: {
      temperature: 24,
      feels_like_temperature: 22,
      weather_condition_cd: 'overcast',
      is_fallback: true,
      precipitation: 0,
      wind_speed: 1.2,
    },
  },
};
