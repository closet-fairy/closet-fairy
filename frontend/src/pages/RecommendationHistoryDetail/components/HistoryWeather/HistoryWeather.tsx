import Icon from '@/components/common/Icon';
import EstimatedBadge from '@/components/EstimatedBadge';
import { WEATHER_CONDITION_ICONS } from '@/constants/weatherConditionIcon';
import {
  formatTemperature,
  getPrecipitationLabel,
  getWeatherLabel,
} from '@/domains/recommendation/weatherSummary';
import type { RecommendationHistoryWeather } from '@/generated/models';
import * as S from './HistoryWeather.styled';

interface HistoryWeatherProps {
  weather: RecommendationHistoryWeather;
}

const HistoryWeather = (props: HistoryWeatherProps) => {
  const { weather } = props;
  const details = [
    `체감 ${formatTemperature(weather.feels_like_temperature)}`,
    getPrecipitationLabel(weather.precipitation),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <S.Container>
      <Icon
        name={WEATHER_CONDITION_ICONS[weather.weather_condition_cd]}
        size="lg"
      />
      <S.Text>
        <S.Heading>
          <S.Label>{getWeatherLabel(weather)}</S.Label>
          {weather.is_fallback && <EstimatedBadge />}
        </S.Heading>
        <S.Details>{details}</S.Details>
      </S.Text>
    </S.Container>
  );
};

export default HistoryWeather;
