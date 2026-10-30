import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Carousel from '@/components/common/Carousel';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import StatusView from '@/components/common/StatusView';
import TopBar from '@/components/common/TopBar';
import OutfitLoading from '@/components/OutfitLoading';
import {
  canViewRecommendationResult,
  getRecommendationProgress,
} from '@/domains/recommendation/recommendationProgress';
import {
  useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost,
  useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet,
} from '@/generated/endpoints/recommendation/recommendation';
import OutfitActions from './components/OutfitActions';
import OutfitCard from './components/OutfitCard';
import OutfitInfoSheet from './components/OutfitInfoSheet';
import * as S from './RecommendationResultPage.styled';

const NOT_FOUND_STATUS = 404;

const RecommendationResultPage = () => {
  const { sessionId } = useParams({
    from: '/recommendation_/sessions/$sessionId_/result',
  });
  const navigate = useNavigate();
  const {
    data: result,
    error,
    isFetching,
    refetch,
  } = useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet(
    sessionId,
  );
  const { mutateAsync: cancelSession } =
    useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost();
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  const isProcessing =
    result !== undefined && getRecommendationProgress(result) === 'processing';
  const isNotFound =
    error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  const isUnavailable =
    isNotFound ||
    (result !== undefined &&
      !isProcessing &&
      !canViewRecommendationResult(result));

  const moveToProgress = useEffectEvent(() => {
    void navigate({
      to: '/recommendation/sessions/$sessionId',
      params: { sessionId },
      replace: true,
    });
  });

  useEffect(() => {
    if (isProcessing) {
      moveToProgress();
    }
  }, [isProcessing]);

  const cancelAndLeave = async () => {
    setIsCanceling(true);

    try {
      await cancelSession({ recommendationSessionId: sessionId });
    } catch {
      // 취소 요청이 실패해도 남은 세션은 BE의 이탈 정리가 닫는다.
    }

    void navigate({ to: '/recommendation', replace: true });
  };

  if (isUnavailable) {
    return (
      <S.StatusPage>
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
      </S.StatusPage>
    );
  }

  if (result === undefined || isProcessing) {
    // 로그인이 만료되면 전역 다이얼로그가 안내하므로, 그 뒤에 실패 화면을 겹치지 않고 로딩 화면을 둔다.
    if (error !== null && !isUnauthorizedError(error)) {
      return (
        <S.StatusPage>
          <TopBar />
          <StatusView
            visual={<Icon name="error" size="2xl" />}
            title="코디를 불러오지 못했어요"
            description={`${error.message}\n돌아가면 이번 추천은 사라져요.`}
            actions={
              <>
                <Button
                  icon="refresh"
                  isFullWidth
                  isLoading={isFetching}
                  isDisabled={isCanceling}
                  onClick={() => void refetch()}
                >
                  다시 시도
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  isFullWidth
                  isLoading={isCanceling}
                  onClick={() => void cancelAndLeave()}
                >
                  돌아가기
                </Button>
              </>
            }
          />
        </S.StatusPage>
      );
    }

    return (
      <S.Container>
        <S.CloseButton>
          <IconButton icon="close" aria-label="추천 그만두기" />
        </S.CloseButton>
        <OutfitLoading />
      </S.Container>
    );
  }

  const { outfits, weather, is_clothing_shortage: isClothingShortage } = result;
  const currentIndex = Math.min(outfitIndex, outfits.length - 1);

  return (
    <S.Container>
      {outfits.length > 1 && (
        <S.Counter>
          <S.CounterCurrent>{currentIndex + 1}</S.CounterCurrent>
          <S.CounterTotal>/ {outfits.length}</S.CounterTotal>
        </S.Counter>
      )}
      <S.CloseButton>
        <IconButton icon="close" aria-label="추천 그만두기" />
      </S.CloseButton>
      <S.CarouselArea>
        <Carousel
          aria-label="추천 코디"
          index={currentIndex}
          onIndexChange={setOutfitIndex}
          isLooped={false}
          arrowVariant="plain"
          arrowInset={S.ARROW_INSET}
        >
          {outfits.map((outfit) => (
            <S.Slide key={outfit.outfit_id}>
              <OutfitCard items={outfit.items} />
            </S.Slide>
          ))}
        </Carousel>
      </S.CarouselArea>
      <OutfitActions
        infoButtonRef={infoButtonRef}
        onInfoClick={() => setIsInfoOpen(true)}
      />
      <OutfitInfoSheet
        outfit={outfits[currentIndex]}
        weather={weather}
        isClothingShortage={isClothingShortage}
        isOpen={isInfoOpen}
        onOpenChange={setIsInfoOpen}
        finalFocus={infoButtonRef}
      />
    </S.Container>
  );
};

export default RecommendationResultPage;
