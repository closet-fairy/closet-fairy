import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import { getWeatherSummary } from '@/domains/recommendation/weatherSummary';
import { usePreviewWeatherWeatherPreviewGet } from '@/generated/endpoints/weather/weather';
import type { WeatherPreview } from '@/generated/models';
import * as S from './WeatherSummary.styled';

const WEATHER_STALE_TIME = 10 * 60 * 1000;

const WEATHER_CONDITION_ICONS: Record<
  WeatherPreview['weather_condition_cd'],
  IconName
> = {
  clear: 'sunny',
  cloudy: 'partly_cloudy_day',
  overcast: 'cloud',
  rain: 'rainy',
  sleet: 'weather_mix',
  snow: 'weather_snowy',
};

interface WeatherSummaryProps {
  sidoNm: string;
  sigunguNm: string;
}

const WeatherSummary = (props: WeatherSummaryProps) => {
  const { sidoNm, sigunguNm } = props;

  const { data, isError } = usePreviewWeatherWeatherPreviewGet(
    { sido_nm: sidoNm, sigungu_nm: sigunguNm },
    { query: { staleTime: WEATHER_STALE_TIME } },
  );

  if (!data && !isError) {
    return null;
  }

  const summary = data ? getWeatherSummary(data) : null;

  if (!summary?.isAvailable) {
    return (
      <S.Container>
        <S.Unavailable>날씨 확인 불가</S.Unavailable>
      </S.Container>
    );
  }

  const { temperatureLabel, condition } = summary;

  return (
    <S.Container>
      {condition && (
        <Icon name={WEATHER_CONDITION_ICONS[condition.cd]} size="sm" />
      )}
      <S.Text>
        {condition
          ? `${temperatureLabel} ${condition.label}`
          : temperatureLabel}
      </S.Text>
    </S.Container>
  );
};

export default WeatherSummary;
