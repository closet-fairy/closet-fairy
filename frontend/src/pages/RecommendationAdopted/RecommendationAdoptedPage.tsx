import { useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { isClientError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';
import TopBar from '@/components/common/TopBar';
import OutfitLoading from '@/components/OutfitLoading';
import { getTpoLabel } from '@/domains/recommendation/tpoPresets';
import { getWeatherLabel } from '@/domains/recommendation/weatherSummary';
import { useGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGet } from '@/generated/endpoints/recommendation/recommendation';
import type { RecommendationHistoryDetail } from '@/generated/models';
import AdoptedOutfitCard from './components/AdoptedOutfitCard';
import * as S from './RecommendationAdoptedPage.styled';

const KST_DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Seoul',
});

const getSummary = (detail: RecommendationHistoryDetail) => {
  const { condition, weather } = detail;

  return [
    KST_DATE_FORMAT.format(new Date(condition.going_out_start_at)),
    getTpoLabel(condition),
    weather && getWeatherLabel(weather),
  ]
    .filter(Boolean)
    .join(' · ');
};

const RecommendationAdoptedPage = () => {
  const { sessionId } = useParams({
    from: '/recommendation_/sessions/$sessionId_/adopted',
  });
  const navigate = useNavigate();
  const router = useRouter();
  const {
    data: detail,
    error,
    isFetching,
    refetch,
  } = useGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGet(
    sessionId,
  );

  // 상세의 뒤로 가기가 목록으로 돌아오도록 채택 완료 자리를 목록으로 바꾼다. 목록이 화면에 스치지 않게 주소만 바꾸고 바로 상세로 간다.
  const openHistoryDetail = () => {
    router.history.replace(
      router.buildLocation({ to: '/recommendation-history' }).href,
    );
    router.history.flush();
    void navigate({
      to: '/recommendation-history/$sessionId',
      params: { sessionId },
    });
  };

  if (detail) {
    return (
      <S.Container>
        <TopBar />
        <StatusView
          visual={<Icon name="check_circle-fill" size="2xl" />}
          title="오늘의 코디로 채택했어요"
          description="추천 내역에 저장했습니다."
          actions={
            <>
              <Button isFullWidth onClick={openHistoryDetail}>
                추천 내역에서 보기
              </Button>
              <Button
                variant="text"
                size="md"
                isFullWidth
                onClick={() =>
                  void navigate({ to: '/recommendation', replace: true })
                }
              >
                닫기
              </Button>
            </>
          }
        >
          <AdoptedOutfitCard
            items={detail.outfit.items}
            summary={getSummary(detail)}
            isWeatherEstimated={detail.weather?.is_fallback ?? false}
            rating={detail.rating}
          />
        </StatusView>
      </S.Container>
    );
  }

  if (isClientError(error) && !isUnauthorizedError(error)) {
    return (
      <S.Container>
        <TopBar />
        <StatusView
          visual={<Icon name="search_off" size="2xl" />}
          title="볼 수 없는 추천이에요"
          description="이미 끝났거나 채택한 추천이에요."
          actions={
            <Button
              isFullWidth
              onClick={() => void navigate({ to: '/closet', replace: true })}
            >
              옷장으로 가기
            </Button>
          }
        />
      </S.Container>
    );
  }

  // 로그인이 만료되면 전역 다이얼로그가 안내하므로, 그 뒤에 실패 화면을 겹치지 않고 로딩 화면을 둔다.
  if (error !== null && !isUnauthorizedError(error)) {
    return (
      <S.Container>
        <TopBar />
        <StatusView
          visual={<Icon name="error" size="2xl" />}
          title="코디를 불러오지 못했어요"
          description={error.message}
          actions={
            <Button
              icon="refresh"
              isFullWidth
              isLoading={isFetching}
              onClick={() => void refetch()}
            >
              다시 시도
            </Button>
          }
        />
      </S.Container>
    );
  }

  return (
    <S.Container>
      <TopBar />
      <OutfitLoading />
    </S.Container>
  );
};

export default RecommendationAdoptedPage;
