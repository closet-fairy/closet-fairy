import { useNavigate, useParams } from '@tanstack/react-router';
import { isNotFoundError } from '@/apis/apiError';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import StarRating from '@/components/common/StarRating';
import TopBar from '@/components/common/TopBar';
import HistoryDetailStatus from '@/components/HistoryDetailStatus';
import HistoryTimeRow from '@/components/HistoryTimeRow';
import { hasFloorCandidates } from '@/domains/recommendation/floorCandidates';
import {
  formatHistoryDateTime,
  formatHistoryGoingOutRange,
} from '@/domains/recommendation/historyTime';
import { formatRegionLabel } from '@/domains/recommendation/regionLabel';
import { getTpoLabel } from '@/domains/recommendation/tpoPresets';
import { useGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGet } from '@/generated/endpoints/recommendation/recommendation';
import useGoBack from '@/hooks/useGoBack';
import HistoryItemGrid from './components/HistoryItemGrid';
import HistoryWeather from './components/HistoryWeather';
import * as S from './RecommendationHistoryDetailPage.styled';

const RecommendationHistoryDetailPage = () => {
  const { sessionId } = useParams({
    from: '/recommendation-history_/$sessionId',
  });
  const navigate = useNavigate();
  const goBack = useGoBack({ to: '/recommendation-history' });
  const {
    data: detail,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGet(
    sessionId,
  );

  const goToList = () =>
    void navigate({ to: '/recommendation-history', replace: true });

  const renderBody = () => {
    if (detail) {
      const { recommended_at: recommendedAt, condition } = detail;
      const { reason, items } = detail.outfit;
      // 켜 둔 채 날이 바뀌어도 어제, 오늘 표기가 맞도록 데이터를 받은 시각을 기준으로 삼는다.
      const now = new Date(dataUpdatedAt);
      const goingOutRange = formatHistoryGoingOutRange(
        condition.going_out_start_at,
        condition.going_out_end_at,
        now,
      );
      const region = formatRegionLabel(condition.sido_nm, condition.sigungu_nm);

      return (
        <S.Content>
          <S.Summary>
            <S.Title>{getTpoLabel(condition)}</S.Title>
            <S.Times>
              <HistoryTimeRow
                icon="schedule"
                label="추천"
                value={formatHistoryDateTime(recommendedAt, now)}
                size="md"
              />
              <HistoryTimeRow
                icon="event"
                label="외출"
                value={`${goingOutRange} · ${region}`}
                size="md"
              />
            </S.Times>
            <StarRating value={detail.rating} isReadOnly size="row" />
          </S.Summary>
          <section>
            <S.SectionHeader>
              <S.SectionTitle>코디 아이템</S.SectionTitle>
              {hasFloorCandidates(items) && (
                <S.FloorLink
                  to="/recommendation-history/$sessionId/floor"
                  params={{ sessionId }}
                >
                  <Icon name="styler" size="sm" />
                  바닥에 펼쳐 보기
                </S.FloorLink>
              )}
            </S.SectionHeader>
            <HistoryItemGrid items={items} />
          </section>
          {detail.weather && <HistoryWeather weather={detail.weather} />}
          {reason !== null && (
            <section>
              <S.ReasonHeading>
                <Icon name="star_shine" size="sm" />
                추천 이유
              </S.ReasonHeading>
              <S.ReasonText>{reason}</S.ReasonText>
            </section>
          )}
        </S.Content>
      );
    }

    return (
      <HistoryDetailStatus
        error={error}
        isRetrying={isFetching}
        onRetry={() => void refetch()}
        onGoToList={goToList}
      />
    );
  };

  return (
    <S.Container>
      <TopBar
        title="추천 내역"
        leading={
          <IconButton
            icon="arrow_back"
            aria-label="뒤로 가기"
            onClick={isNotFoundError(error) ? goToList : goBack}
          />
        }
      />
      {renderBody()}
    </S.Container>
  );
};

export default RecommendationHistoryDetailPage;
