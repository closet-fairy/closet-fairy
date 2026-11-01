import { Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { isNotFoundError } from '@/apis/apiError';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import TopBar from '@/components/common/TopBar';
import HistoryDetailStatus from '@/components/HistoryDetailStatus';
import OutfitFloor from '@/components/OutfitFloor';
import { hasFloorCandidates } from '@/domains/recommendation/floorCandidates';
import { formatHistoryGoingOutRange } from '@/domains/recommendation/historyTime';
import { getTpoLabel } from '@/domains/recommendation/tpoPresets';
import { useGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGet } from '@/generated/endpoints/recommendation/recommendation';
import useGoBack from '@/hooks/useGoBack';
import * as S from './RecommendationHistoryFloorPage.styled';

const RecommendationHistoryFloorPage = () => {
  const { sessionId } = useParams({
    from: '/recommendation-history_/$sessionId_/floor',
  });
  const navigate = useNavigate();
  const goBack = useGoBack({
    to: '/recommendation-history/$sessionId',
    params: { sessionId },
  });
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

  if (!detail) {
    return (
      <S.StatusPage>
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
        <HistoryDetailStatus
          error={error}
          isRetrying={isFetching}
          onRetry={() => void refetch()}
          onGoToList={goToList}
        />
      </S.StatusPage>
    );
  }

  const { condition, outfit } = detail;

  if (!hasFloorCandidates(outfit.items)) {
    return (
      <Navigate
        to="/recommendation-history/$sessionId"
        params={{ sessionId }}
        replace
      />
    );
  }

  return (
    <S.Container>
      <S.Header>
        <IconButton icon="arrow_back" aria-label="뒤로 가기" onClick={goBack} />
        <S.Heading>
          <S.Title>{getTpoLabel(condition)}</S.Title>
          <S.GoingOut>
            <Icon name="event" size="xs" />
            <S.GoingOutRange>
              {formatHistoryGoingOutRange(
                condition.going_out_start_at,
                condition.going_out_end_at,
                new Date(dataUpdatedAt),
              )}
            </S.GoingOutRange>
          </S.GoingOut>
        </S.Heading>
      </S.Header>
      <S.Floor>
        <OutfitFloor
          items={outfit.items}
          seed={{ order: sessionId, id: sessionId }}
          variant="floor"
          entrance={{ isActive: true }}
        />
      </S.Floor>
    </S.Container>
  );
};

export default RecommendationHistoryFloorPage;
