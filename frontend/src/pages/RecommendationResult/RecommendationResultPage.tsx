import { replaceEqualDeep, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Carousel from '@/components/common/Carousel';
import Dialog from '@/components/common/Dialog';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import StatusView from '@/components/common/StatusView';
import { showToast } from '@/components/common/ToastProvider/ToastProvider.toast';
import TopBar from '@/components/common/TopBar';
import OutfitLoading from '@/components/OutfitLoading';
import {
  canViewRecommendationResult,
  getRecommendationProgress,
  keepViewedOutfits,
} from '@/domains/recommendation/recommendationProgress';
import {
  getGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGetQueryOptions,
  useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost,
  useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet,
  useRateRecommendationRecommendationSessionsRecommendationSessionIdRatingPost,
} from '@/generated/endpoints/recommendation/recommendation';
import type { RecommendationResult } from '@/generated/models';
import waitForPopState from '@/utils/waitForPopState';
import OutfitActions from './components/OutfitActions';
import OutfitCard from './components/OutfitCard';
import OutfitInfoSheet from './components/OutfitInfoSheet';
import RatingDialog from './components/RatingDialog';
import * as S from './RecommendationResultPage.styled';

type OpenLayer = 'info' | 'rating' | null;
type RatingRejection = 'expired' | 'unavailable' | null;
type LeaveTarget = 'input' | 'clothingRegister';

const NOT_FOUND_STATUS = 404;
const SESSION_NOT_FOUND_CODE = 'SESSION_NOT_FOUND';
const SESSION_ALREADY_SETTLED_CODE = 'SESSION_ALREADY_SETTLED';
// 취소나 이탈로 이미 끝난 세션에 별점을 보냈을 때 내려오는 코드다.
const SESSION_NOT_RATABLE_CODE = 'SESSION_NOT_RATABLE';

const hasOutfitList = (
  value: unknown,
): value is Pick<RecommendationResult, 'outfits'> =>
  typeof value === 'object' &&
  value !== null &&
  'outfits' in value &&
  Array.isArray(value.outfits);

const shareResult = (previous: unknown, next: unknown) =>
  hasOutfitList(previous) && hasOutfitList(next)
    ? replaceEqualDeep(previous, keepViewedOutfits(previous, next))
    : next;

const RecommendationResultPage = () => {
  const { sessionId } = useParams({
    from: '/recommendation_/sessions/$sessionId_/result',
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: result,
    error,
    isFetching,
    refetch,
  } = useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet(
    sessionId,
    { query: { structuralSharing: shareResult } },
  );
  const { mutateAsync: cancelSession } =
    useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost();
  const { mutate: rateOutfit, isPending: isRatingPending } =
    useRateRecommendationRecommendationSessionsRecommendationSessionIdRatingPost();
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [openLayer, setOpenLayer] = useState<OpenLayer>(null);
  const [rating, setRating] = useState(0);
  const [ratingRejection, setRatingRejection] = useState<RatingRejection>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<LeaveTarget>('input');
  const [isCanceling, setIsCanceling] = useState(false);
  const [isMovingToAdopted, setIsMovingToAdopted] = useState(false);
  const isLeaveAllowedRef = useRef(false);
  const urlRestoreRef = useRef<Promise<void> | null>(null);
  const leaveFocusRef = useRef<HTMLButtonElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const adoptButtonRef = useRef<HTMLButtonElement>(null);

  const isProcessing =
    result !== undefined && getRecommendationProgress(result) === 'processing';
  const isSubmittingRating = isRatingPending || isMovingToAdopted;
  // 채택이나 취소가 끝나는 사이에 재조회가 도착해도 세션이 끝난 것으로 안내하지 않는다.
  const isResultGone =
    result !== undefined &&
    !isProcessing &&
    !isSubmittingRating &&
    !isCanceling &&
    !canViewRecommendationResult(result);
  const isAdopted = result?.session_status_cd === 'completed';
  const hasOutfits = result !== undefined && result.outfits.length > 0;
  const isNotFound =
    error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  const isUnavailable =
    ratingRejection === 'unavailable' ||
    isNotFound ||
    (isResultGone && (!hasOutfits || isAdopted));
  const isExpired =
    !isUnavailable && (ratingRejection === 'expired' || isResultGone);
  const isLeaveConfirmNeeded = !isUnavailable && !isExpired && !isProcessing;

  const openLeaveDialog = (target: LeaveTarget) => {
    setOpenLayer(null);
    setLeaveTarget(target);
    setIsLeaveDialogOpen(true);
  };

  useBlocker({
    shouldBlockFn: ({ action, current, next }) => {
      if (
        !isLeaveConfirmNeeded ||
        isLeaveAllowedRef.current ||
        current.pathname === next.pathname
      ) {
        return false;
      }

      if (action === 'BACK' || action === 'FORWARD' || action === 'GO') {
        urlRestoreRef.current = waitForPopState();
      }

      // 서랍이나 별점 모달이 열려 있을 때 뒤로 가기는 나가려는 것이 아니라 그 층을 닫으려는 것으로 본다.
      if (openLayer !== null) {
        if (!isSubmittingRating) {
          setOpenLayer(null);
        }
      } else if (!isLeaveDialogOpen && !isCanceling) {
        openLeaveDialog('input');
      }

      return true;
    },
    enableBeforeUnload: isLeaveConfirmNeeded,
  });

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

  const leaveToInput = () => {
    void navigate({ to: '/recommendation', replace: true });
  };

  const cancelAndLeave = async (target: LeaveTarget) => {
    setIsCanceling(true);

    try {
      await cancelSession({ recommendationSessionId: sessionId });
    } catch {
      // 취소 요청이 실패해도 남은 세션은 BE의 이탈 정리가 닫는다.
    }

    await urlRestoreRef.current;
    isLeaveAllowedRef.current = true;
    setIsLeaveDialogOpen(false);

    if (target === 'clothingRegister') {
      void navigate({
        to: '/closet',
        search: { register: true },
        replace: true,
      });
      return;
    }

    leaveToInput();
  };

  const openRatingDialog = () => {
    setRating(0);
    setOpenLayer('rating');
  };

  const leaveDialog = (
    <Dialog
      isOpen={isLeaveConfirmNeeded && isLeaveDialogOpen}
      onOpenChange={setIsLeaveDialogOpen}
      title="추천을 그만둘까요?"
      description={'받은 코디가 모두 사라지고\n되돌릴 수 없어요.'}
      isDismissable={!isCanceling}
      finalFocus={isExpired ? undefined : leaveFocusRef}
      footer={
        <>
          <Button
            variant="outline"
            isFullWidth
            isLoading={isCanceling}
            onClick={() => void cancelAndLeave(leaveTarget)}
          >
            그만두기
          </Button>
          <Button
            variant="text"
            isFullWidth
            isDisabled={isCanceling}
            onClick={() => setIsLeaveDialogOpen(false)}
          >
            계속 보기
          </Button>
        </>
      }
    />
  );

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

  if (result === undefined || isProcessing || !hasOutfits) {
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
                  ref={leaveFocusRef}
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
                  onClick={() => void cancelAndLeave('input')}
                >
                  돌아가기
                </Button>
              </>
            }
          />
          {leaveDialog}
        </S.StatusPage>
      );
    }

    return (
      <S.Container>
        <S.CloseButton>
          <IconButton
            ref={leaveFocusRef}
            icon="close"
            aria-label="추천 그만두기"
            onClick={() => openLeaveDialog('input')}
          />
        </S.CloseButton>
        <OutfitLoading />
        {leaveDialog}
      </S.Container>
    );
  }

  const { outfits, weather, is_clothing_shortage: isClothingShortage } = result;
  const currentIndex = Math.min(outfitIndex, outfits.length - 1);
  const currentOutfit = outfits[currentIndex];

  const moveToAdopted = async () => {
    setIsMovingToAdopted(true);
    // 채택 완료 화면이 로딩 없이 바로 그려지도록 내역을 먼저 받아 둔다. 실패하면 그 화면이 다시 불러온다.
    await queryClient.prefetchQuery({
      ...getGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGetQueryOptions(
        sessionId,
      ),
      retry: false,
    });
    await urlRestoreRef.current;
    isLeaveAllowedRef.current = true;
    await navigate({
      to: '/recommendation/sessions/$sessionId/adopted',
      params: { sessionId },
      replace: true,
    });
  };

  const submitRating = () => {
    rateOutfit(
      {
        recommendationSessionId: sessionId,
        data: { outfit_id: currentOutfit.outfit_id, rating },
      },
      {
        onSuccess: () => void moveToAdopted(),
        onError: (ratingError) => {
          if (isUnauthorizedError(ratingError)) {
            return;
          }

          if (
            ratingError.code === SESSION_ALREADY_SETTLED_CODE ||
            ratingError.code === SESSION_NOT_FOUND_CODE
          ) {
            setRatingRejection('unavailable');
            return;
          }

          if (ratingError.code === SESSION_NOT_RATABLE_CODE) {
            setRatingRejection('expired');
            return;
          }

          showToast({
            tone: 'error',
            title: '코디를 채택하지 못했어요',
            description: ratingError.message,
          });
        },
      },
    );
  };

  return (
    <S.Container>
      {outfits.length > 1 && (
        <S.Counter>
          <S.CounterCurrent>{currentIndex + 1}</S.CounterCurrent>
          <S.CounterTotal>/ {outfits.length}</S.CounterTotal>
        </S.Counter>
      )}
      <S.CloseButton>
        <IconButton
          ref={leaveFocusRef}
          icon="close"
          aria-label="추천 그만두기"
          onClick={() => openLeaveDialog('input')}
        />
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
        adoptButtonRef={adoptButtonRef}
        onInfoClick={() => setOpenLayer('info')}
        onAdoptClick={openRatingDialog}
      />
      <OutfitInfoSheet
        outfit={currentOutfit}
        weather={weather}
        isClothingShortage={isClothingShortage}
        isOpen={openLayer === 'info' && !isExpired}
        onOpenChange={(isOpen) => setOpenLayer(isOpen ? 'info' : null)}
        onAdoptClick={openRatingDialog}
        onRegisterClothingClick={() => openLeaveDialog('clothingRegister')}
        finalFocus={
          openLayer === 'rating' || isLeaveDialogOpen || isExpired
            ? undefined
            : infoButtonRef
        }
      />
      <RatingDialog
        isOpen={openLayer === 'rating' && !isExpired}
        rating={rating}
        isSubmitting={isSubmittingRating}
        onRatingChange={setRating}
        onSubmit={submitRating}
        onClose={() => setOpenLayer(null)}
        finalFocus={isExpired || isLeaveDialogOpen ? undefined : adoptButtonRef}
      />
      {leaveDialog}
      <Dialog
        isOpen={isExpired}
        onOpenChange={() => {}}
        title="추천 시간이 끝났어요"
        description={
          '30분 동안 아무 동작이 없어 추천이 끝났어요.\n새로 추천받아 주세요.'
        }
        isDismissable={false}
        footer={
          <Button isFullWidth onClick={leaveToInput}>
            새로 추천받기
          </Button>
        }
      />
    </S.Container>
  );
};

export default RecommendationResultPage;
