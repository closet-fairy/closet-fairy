import Icon from '@/components/common/Icon';
import EstimatedBadge from '@/components/EstimatedBadge';
import HistoryTimeRow from '@/components/HistoryTimeRow';
import OutfitItemImage from '@/components/OutfitItemImage';
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
          <S.Rating role="img" aria-label={`별점 ${rating}점`}>
            <Icon name="star-fill" size="xs" />
            <S.RatingValue aria-hidden>{rating}</S.RatingValue>
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
      <S.Thumbnails>
        {visibleItems.map((thumbnail, thumbnailIndex) => (
          // 같은 옷이 두 번 올 수 없지만 고유 번호가 없어 이름과 순서로 구분한다.
          <OutfitItemImage
            key={`${thumbnail.item_name}-${thumbnailIndex}`}
            item={thumbnail}
            size="sm"
          />
        ))}
        {hiddenCount > 0 && <S.HiddenCount>+{hiddenCount}</S.HiddenCount>}
      </S.Thumbnails>
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
