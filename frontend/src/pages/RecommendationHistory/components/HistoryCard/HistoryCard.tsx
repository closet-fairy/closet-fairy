import Icon from '@/components/common/Icon';
import StarRating from '@/components/common/StarRating';
import EstimatedBadge from '@/components/EstimatedBadge';
import HistoryTimeRow from '@/components/HistoryTimeRow';
import OutfitThumbnails from '@/components/OutfitThumbnails';
import { WEATHER_CONDITION_ICONS } from '@/constants/weatherConditionIcon';
import { formatHistoryDateTime } from '@/domains/recommendation/historyTime';
import { limitOutfitThumbnails } from '@/domains/recommendation/outfitThumbnails';
import { formatRegionLabel } from '@/domains/recommendation/regionLabel';
import { getTpoLabel } from '@/domains/recommendation/tpoPresets';
import {
  formatTemperature,
  getWeatherLabel,
} from '@/domains/recommendation/weatherSummary';
import type { RecommendationHistoryItem } from '@/generated/models';
import * as S from './HistoryCard.styled';

interface HistoryCardProps {
  item: RecommendationHistoryItem;
  now: Date;
}

const HistoryCard = (props: HistoryCardProps) => {
  const { item, now } = props;
  const {
    recommended_at: recommendedAt,
    condition,
    weather,
    rating,
    thumbnails,
  } = item;
  const { visibleItems, hiddenCount } = limitOutfitThumbnails(thumbnails);
  const goingOutStart = formatHistoryDateTime(
    condition.going_out_start_at,
    now,
  );
  const region = formatRegionLabel(condition.sido_nm, condition.sigungu_nm);

  return (
    <S.Container>
      <S.Summary>
        <S.Heading>
          <S.Title>{getTpoLabel(condition)}</S.Title>
          <S.Rating>
            <StarRating value={rating} isReadOnly size="sm" />
          </S.Rating>
        </S.Heading>
        <S.Times>
          <HistoryTimeRow
            icon="schedule"
            label="추천"
            value={formatHistoryDateTime(recommendedAt, now)}
          />
          <HistoryTimeRow
            icon="event"
            label="외출"
            value={`${goingOutStart} · ${region}`}
          />
        </S.Times>
      </S.Summary>
      <OutfitThumbnails items={visibleItems} hiddenCount={hiddenCount} />
      {weather && (
        <S.Weather>
          <Icon
            name={WEATHER_CONDITION_ICONS[weather.weather_condition_cd]}
            size="xs"
          />
          <S.WeatherLabel>
            {`${getWeatherLabel(weather)} · 체감 ${formatTemperature(weather.feels_like_temperature)}`}
          </S.WeatherLabel>
          {weather.is_fallback && <EstimatedBadge />}
        </S.Weather>
      )}
    </S.Container>
  );
};

export default HistoryCard;
